
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Buscar configurações do WhatsApp
        const { data: settings, error: settingsError } = await supabaseClient
            .from('whatsapp_settings')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (settingsError || !settings) {
            console.error('Configurações do WhatsApp não encontradas ou inativas');
            return new Response(JSON.stringify({ message: 'WhatsApp inativo' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const whatsappSettings = settings;
        const provider = whatsappSettings.provider || 'evolution';

        // 2. Definir intervalos de tempo
        const now = new Date();

        // Intervalo para 24h (1 dia antes)
        const start24h = new Date(now.getTime() + 23 * 60 * 60 * 1000); // +23h
        const end24h = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // +25h

        // Intervalo para 2h (2 horas antes)
        const start2h = new Date(now.getTime() + 1 * 60 * 60 * 1000);   // +1h
        const end2h = new Date(now.getTime() + 3 * 60 * 60 * 1000);     // +3h

        console.log(`Verificando eventos entre:`);
        console.log(`24h: ${start24h.toISOString()} - ${end24h.toISOString()}`);
        console.log(`2h: ${start2h.toISOString()} - ${end2h.toISOString()}`);

        // 3. Buscar eventos
        // Nota: A data e hora no banco são colunas separadas (date e start_time).
        // Precisamos combinar para comparar. Isso é complexo em SQL puro via JS.
        // Vamos simplificar: buscar eventos dos próximos 2 dias e filtrar no código.

        const { data: events, error: eventsError } = await supabaseClient
            .from('events')
            .select('*')
            .gte('date', now.toISOString().split('T')[0]) // Eventos de hoje em diante
            .neq('status', 'Cancelado');

        if (eventsError) throw eventsError;

        let sentCount = 0;

        for (const event of events) {
            // Construir data completa do evento
            const eventDateTimeStr = `${event.date}T${event.start_time}`;

            // Criar data baseada na string (será interpretada como UTC no servidor)
            const eventDate = new Date(eventDateTimeStr);

            // CORREÇÃO DE FUSO HORÁRIO (MANAUS -04:00)
            // O evento "09:00" no banco significa 09:00 em Manaus.
            // 09:00 Manaus = 13:00 UTC.
            // O new Date("...09:00") cria 09:00 UTC.
            // Precisamos adicionar 4 horas para transformar em 13:00 UTC (horário real do evento).
            eventDate.setHours(eventDate.getHours() + 4);

            // Calcular tempo até o evento
            const now = new Date();
            const timeUntilEvent = eventDate.getTime() - now.getTime();
            const hoursUntilEvent = timeUntilEvent / (1000 * 60 * 60);

            console.log(`Evento: ${event.name} (${event.start_time})`);
            console.log(`Horário Ajustado (UTC): ${eventDate.toISOString()}`);
            console.log(`Agora (UTC): ${now.toISOString()}`);
            console.log(`Horas até o evento: ${hoursUntilEvent.toFixed(2)}`);

            let type = null;

            // Lógica de 24h (entre 23h e 25h)
            if (hoursUntilEvent >= 23 && hoursUntilEvent <= 25 && !event.notification_24h_sent) {
                type = '24h';
            }
            // Lógica de 2h (entre 1h e 3h)
            else if (hoursUntilEvent >= 1 && hoursUntilEvent <= 3 && !event.notification_2h_sent) {
                type = '2h';
            }

            if (type) {
                console.log(`>>> Disparando notificação ${type} para evento ${event.name}`);

                // Buscar templates de mensagens
                const { data: templates, error: templatesError } = await supabaseClient
                    .from('whatsapp_message_templates')
                    .select('*')
                    .eq('active', true);

                if (templatesError) {
                    console.error('Erro ao buscar templates:', templatesError);
                }

                const template24h = templates?.find(t => t.template_type === '24h_before');
                const template2h = templates?.find(t => t.template_type === '2h_before');

                // Buscar voluntários escalados
                const { data: volunteers, error: volError } = await supabaseClient
                    .from('event_volunteers')
                    .select('volunteer_id, volunteers(name, phone, user_id)') // Adicionado user_id para push notifications
                    .eq('event_id', event.id);

                if (volError) {
                    console.error(`Erro ao buscar voluntários para evento ${event.id}:`, volError);
                    continue;
                }

                // Enviar mensagens
                // Enviar WhatsApp se configurado
                if (whatsappSettings) { // Usar whatsappSettings que já está definido
                    for (const volunteer of volunteers) {
                        const phone = volunteer.volunteers?.phone; // Apenas se houver volunteers aninhado
                        const name = volunteer.volunteers?.name || 'Voluntário';

                        if (phone) {
                            // Usar template do banco ou fallback para mensagem padrão
                            const template = type === '24h' ? template24h : template2h;
                            let waMessage = '';

                            if (template) {
                                // Substituir variáveis no template
                                waMessage = template.message_content
                                    .replace('{nome}', volunteer.volunteers.name.split(' ')[0])
                                    .replace('{evento}', event.name)
                                    .replace('{horario}', event.start_time);
                            } else {
                                // Fallback para mensagem padrão
                                waMessage = type === '24h'
                                    ? `Olá ${volunteer.volunteers.name.split(' ')[0]}, lembrete: Você está escalado para o evento *${event.name}* amanhã às ${event.start_time}.`
                                    : `Olá ${volunteer.volunteers.name.split(' ')[0]}, lembrete: O evento *${event.name}* começa em breve (às ${event.start_time}).`;
                            }

                            await sendWhatsAppMessage(whatsappSettings, phone, waMessage, supabaseClient); // Ajustado para a assinatura da função
                            sentCount++; // Contar cada mensagem WhatsApp enviada
                        }
                    }
                }

                // Enviar Push Notification (PWA)
                // A lógica de fuso horário já foi corrigida acima, então o disparo ocorrerá na hora certa.
                console.log(`Enviando Push Notifications para ${volunteers.length} voluntários do evento ${event.name}`);

                // Chamar a função create-notifications para disparar o push
                // Isso evita duplicar a configuração do web-push e chaves VAPID aqui
                const userIds = volunteers.map((v: any) => v.volunteers?.user_id).filter((id: any) => id);

                if (userIds.length > 0) {
                    // Buscar template de push notification
                    const pushTemplateType = type === '24h' ? 'push_24h_before' : 'push_2h_before';
                    const { data: pushTemplate } = await supabaseClient
                        .from('whatsapp_message_templates')
                        .select('message_content')
                        .eq('template_type', pushTemplateType)
                        .eq('active', true)
                        .single();

                    let pushMessage = '';
                    if (pushTemplate) {
                        // Substituir variáveis no template
                        pushMessage = pushTemplate.message_content
                            .replace('{evento}', event.name)
                            .replace('{horario}', event.start_time);
                    } else {
                        // Fallback para mensagem padrão
                        pushMessage = type === '24h'
                            ? `Lembrete (24h): Você está escalado para "${event.name}" amanhã às ${event.start_time}.`
                            : `Lembrete (2h): Você está escalado para "${event.name}" hoje às ${event.start_time}.`;
                    }

                    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/create-notifications`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                        },
                        body: JSON.stringify({
                            targetType: 'event',
                            eventId: event.id,
                            userIds: userIds,
                            message: pushMessage,
                            // notifyType: 'manual_reminder' // Opcional, para log
                        })
                    });
                }

                // Atualizar flag no banco
                if (type === '24h') {
                    await supabaseClient
                        .from('events')
                        .update({ notification_24h_sent: true })
                        .eq('id', event.id);
                } else {
                    await supabaseClient
                        .from('events')
                        .update({ notification_2h_sent: true })
                        .eq('id', event.id);
                }
            }
        }

        return new Response(JSON.stringify({ success: true, sent_count: sentCount }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error('Erro no auto-notify:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});

async function sendWhatsAppMessage(settings: any, phone: string, message: string, supabase: any) {
    try {
        const formattedNumber = phone.replace(/\D/g, '');
        const provider = settings.provider || 'evolution';
        let evolutionData = null;
        let errorMessage = null;
        let status = 'success';

        if (provider === 'evolution') {
            const response = await fetch(
                `${settings.evolution_url}/message/sendText/${settings.session_name}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': settings.token,
                        'ngrok-skip-browser-warning': 'true',
                    },
                    body: JSON.stringify({
                        number: formattedNumber,
                        text: message
                    })
                }
            );

            if (!response.ok) {
                const text = await response.text();
                status = 'error';
                errorMessage = `Erro API: ${response.status} - ${text}`;
            } else {
                evolutionData = await response.json();
            }
        } else {
            // Genérico (simplificado)
            const response = await fetch(settings.evolution_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.token}` },
                body: JSON.stringify({ phone: formattedNumber, message })
            });
            if (!response.ok) {
                status = 'error';
                errorMessage = await response.text();
            }
        }

        // Log
        await supabase.from('whatsapp_logs').insert({
            recipient_phone: formattedNumber,
            message_content: message,
            status: status,
            response_data: evolutionData,
            error_message: errorMessage
        });

    } catch (err) {
        console.error(`Erro ao enviar para ${phone}:`, err);
    }
}
