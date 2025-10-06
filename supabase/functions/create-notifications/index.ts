// supabase/functions/create-notifications/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4';
import { corsHeaders } from '../_shared/cors.ts';
// Switched to esm.sh version of web-push for better stability in Deno Deploy.
import webpush from 'https://esm.sh/web-push@3.6.7';

declare const Deno: any;

// Define the PushSubscription type locally as it's no longer imported.
interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}


const sendPushNotifications = async (supabaseAdmin: any, userIds: string[], payload: { title: string, body: string, url: string }) => {
    // Obtenha as chaves VAPID das variáveis de ambiente
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
        console.error("As chaves VAPID não estão configuradas. Pulando notificações push.");
        return;
    }
    
    // 1. Busque as inscrições para os IDs de usuário fornecidos
    const { data: subscriptions, error: subError } = await supabaseAdmin
        .from('push_subscriptions')
        .select('subscription_data, endpoint')
        .in('user_id', userIds);

    if (subError) {
        console.error('Erro ao buscar inscrições push:', subError);
        return;
    }
    
    if (!subscriptions || subscriptions.length === 0) {
        return; // Nenhuma inscrição para enviar
    }
    
    // 2. Envie uma notificação para cada inscrição
    const promises = subscriptions.map(async (sub) => {
        try {
            const subscription = sub.subscription_data as PushSubscription;
            
            // Adapt the call to match the web-push (Node.js) library API
            const options = {
                vapidDetails: {
                    subject: "mailto:admin@example.com",
                    publicKey: vapidPublicKey,
                    privateKey: vapidPrivateKey,
                },
            };

            await webpush.sendNotification(
                subscription,
                JSON.stringify(payload),
                options
            );
        } catch (pushError) {
            console.error(`Falha ao enviar notificação push para ${sub.endpoint}:`, pushError);
            // Lida com inscrições expiradas ou inválidas
            // The node library returns an error object with a statusCode property
            if (pushError.statusCode === 404 || pushError.statusCode === 410) {
                console.log('Inscrição expirou ou não é mais válida. Deletando.');
                await supabaseAdmin
                    .from('push_subscriptions')
                    .delete()
                    .eq('endpoint', sub.endpoint);
            }
        }
    });

    await Promise.all(promises);
};


Deno.serve(async (req) => {
  // Lida com as requisições de preflight do CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { notifications } = await req.json();

    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      throw new Error("O array 'notifications' é obrigatório no corpo da requisição.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      throw insertError;
    }

    // ---- INÍCIO: Lógica de Notificação Push ----
    // Agrupa notificações por usuário para enviar um único push por usuário
    const notificationsByUser = new Map<string, any[]>();
    notifications.forEach(n => {
        if (!notificationsByUser.has(n.user_id)) {
            notificationsByUser.set(n.user_id, []);
        }
        notificationsByUser.get(n.user_id)!.push(n);
    });

    const userIds = Array.from(notificationsByUser.keys());
    
    // Dispara notificações push para os usuários afetados
    for (const userId of userIds) {
        const userNotifications = notificationsByUser.get(userId)!;
        const title = 'Nova Notificação do App Voluntários';
        const body = userNotifications.length > 1
            ? `Você tem ${userNotifications.length} novas notificações.`
            : userNotifications[0].message;
        
        // Determina a URL de destino com base no conteúdo da notificação
        let targetUrl = '/#/notifications'; // URL padrão
        if (userNotifications.length === 1 && userNotifications[0].related_event_id) {
            targetUrl = '/#/events';
        }
        
        await sendPushNotifications(supabaseAdmin, [userId], { title, body, url: targetUrl });
    }
    // ---- FIM: Lógica de Notificação Push ----

    return new Response(JSON.stringify({ success: true, message: 'Notificações criadas com sucesso.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Erro na função create-notifications:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});