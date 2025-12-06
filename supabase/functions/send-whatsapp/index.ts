import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppRequest {
    number: string;
    message: string;
}

interface WhatsAppSettings {
    evolution_url: string;
    token: string;
    session_name: string;
    active: boolean;
    provider?: string;
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Criar cliente Supabase
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Verificar autenticação
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Não autorizado');
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

        if (authError || !user) {
            throw new Error('Não autorizado');
        }

        // Verificar se é admin ou líder
        const userRole = user.user_metadata?.role;
        if (userRole !== 'admin' && userRole !== 'leader' && userRole !== 'lider') {
            throw new Error('Apenas administradores e líderes podem enviar mensagens via WhatsApp');
        }

        // Obter dados da requisição
        let { number, message, templateType }: { number: string, message: string, templateType?: string } = await req.json();

        if (!number || !message) {
            throw new Error('Número e mensagem são obrigatórios');
        }

        // Detectar formato legado se nenhum templateType for fornecido
        if (!templateType && message.startsWith('📱 *Mensagem do Dashboard*')) {
            // Tentar extrair o conteúdo real da mensagem
            const match = message.match(/📱 \*Mensagem do Dashboard\*\n\n([\s\S]*?)\n\n_Enviado por:/);
            if (match && match[1]) {
                message = match[1].trim();
                templateType = 'dashboard_message';
                console.log('Formato legado detectado. Convertendo para template dashboard_message. Mensagem extraída:', message);
            }
        }

        let finalMessage = message;

        // Se um templateType for fornecido, buscar e usar o template
        if (templateType) {
            const { data: template } = await supabaseClient
                .from('whatsapp_message_templates')
                .select('*')
                .eq('template_type', templateType)
                .eq('active', true)
                .single();

            if (template) {
                // Obter nome do remetente
                let senderName = 'Admin';
                if (user.user_metadata?.name) {
                    senderName = user.user_metadata.name;
                } else {
                    // Tentar buscar no profiles ou volunteers
                    const { data: profile } = await supabaseClient
                        .from('profiles')
                        .select('name')
                        .eq('id', user.id)
                        .single();
                    if (profile?.name) senderName = profile.name;
                }

                finalMessage = template.message_content
                    .replace('{mensagem}', message)
                    .replace('{remetente}', senderName);
            }
        }

        // Buscar configurações do WhatsApp
        const { data: settings, error: settingsError } = await supabaseClient
            .from('whatsapp_settings')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (settingsError || !settings) {
            throw new Error('Configurações do WhatsApp não encontradas ou inativas');
        }

        const whatsappSettings = settings as WhatsAppSettings;

        // Formatar número (remover caracteres especiais, mas manter @ e . para JIDs)
        const formattedNumber = number.includes('@') ? number.trim() : number.replace(/\D/g, '');

        let evolutionData = null;
        let errorMessage = null;
        let status = 'success';

        try {
            const provider = whatsappSettings.provider || 'evolution';

            if (provider === 'evolution') {
                // Preparar payload para Evolution API
                const evolutionPayload = {
                    number: formattedNumber,
                    text: finalMessage,
                };

                console.log('Enviando para Evolution:', JSON.stringify(evolutionPayload));

                const evolutionResponse = await fetch(
                    `${whatsappSettings.evolution_url}/message/sendText/${whatsappSettings.session_name}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': whatsappSettings.token,
                            'ngrok-skip-browser-warning': 'true',
                        },
                        body: JSON.stringify(evolutionPayload),
                    }
                );

                console.log('Status Evolution:', evolutionResponse.status);

                if (!evolutionResponse.ok) {
                    const errorText = await evolutionResponse.text();
                    console.error('Erro da Evolution API:', errorText);
                    status = 'error';
                    errorMessage = `Falha ao enviar mensagem: ${evolutionResponse.status} - ${errorText}`;
                } else {
                    evolutionData = await evolutionResponse.json();
                }
            } else if (provider === 'generic') {
                // Exemplo de implementação genérica (pode ser adaptada para Z-API, etc)
                // Assumindo um payload padrão { phone: "...", message: "..." }
                const genericPayload = {
                    phone: formattedNumber,
                    message: finalMessage,
                };

                const genericResponse = await fetch(
                    whatsappSettings.evolution_url, // Usando o campo URL genericamente
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${whatsappSettings.token}`, // Usando token como Bearer
                        },
                        body: JSON.stringify(genericPayload),
                    }
                );

                if (!genericResponse.ok) {
                    const errorText = await genericResponse.text();
                    status = 'error';
                    errorMessage = `Falha na API Genérica: ${genericResponse.status} - ${errorText}`;
                } else {
                    evolutionData = await genericResponse.json();
                }
            } else {
                throw new Error(`Provedor de API desconhecido: ${provider}`);
            }

        } catch (fetchError) {
            console.error('Erro de conexão com API de WhatsApp:', fetchError);
            status = 'error';
            errorMessage = fetchError.message || 'Erro de conexão';
        }

        // Salvar log no banco de dados
        await supabaseClient.from('whatsapp_logs').insert({
            recipient_phone: formattedNumber,
            message_content: finalMessage,
            status: status,
            response_data: evolutionData,
            error_message: errorMessage
        });

        if (status === 'error') {
            throw new Error(errorMessage || 'Erro desconhecido ao enviar mensagem');
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Mensagem enviada com sucesso',
                data: evolutionData,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('Erro ao enviar mensagem WhatsApp:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || 'Erro ao enviar mensagem',
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
