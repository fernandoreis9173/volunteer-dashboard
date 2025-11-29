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

        // Verificar se é admin
        const userRole = user.user_metadata?.role;
        if (userRole !== 'admin') {
            throw new Error('Apenas administradores podem enviar mensagens via WhatsApp');
        }

        // Obter dados da requisição
        const { number, message }: WhatsAppRequest = await req.json();

        if (!number || !message) {
            throw new Error('Número e mensagem são obrigatórios');
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

        // Formatar número (remover caracteres especiais)
        const formattedNumber = number.replace(/\D/g, '');

        let evolutionData = null;
        let errorMessage = null;
        let status = 'success';

        try {
            const provider = whatsappSettings.provider || 'evolution';

            if (provider === 'evolution') {
                // Preparar payload para Evolution API
                const evolutionPayload = {
                    number: formattedNumber,
                    text: message,
                };

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
                    message: message,
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
            message_content: message,
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
