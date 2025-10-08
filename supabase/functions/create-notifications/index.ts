// supabase/functions/create-notifications/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';
import * as webpush from 'npm:web-push@3.6.7';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};
const sendPushNotifications = async (subscriptions, payload, supabaseAdmin)=>{
  const pushPromises = subscriptions.map(async (sub)=>{
    try {
      const subscriptionData = typeof sub.subscription_data === 'string' ? JSON.parse(sub.subscription_data) : sub.subscription_data;
      const fullSubscription = {
        endpoint: sub.endpoint,
        keys: subscriptionData.keys
      };
      await webpush.sendNotification(fullSubscription, payload);
    } catch (error) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.log(`Inscrição ${sub.endpoint} expirada. Removendo...`);
        await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      } else {
        console.error('Falha ao enviar push notification:', error.body || error.message);
      }
    }
  });
  await Promise.all(pushPromises);
};

// FIX: Declare Deno to resolve TypeScript errors for Deno-specific APIs.
declare const Deno: any;

Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { notifications, broadcastMessage } = await req.json();
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    
    // --- Configuração das Chaves VAPID ---
    // ATENÇÃO: As chaves VAPID são lidas das 'Secrets' da Edge Function pelo NOME da variável.
    // Ex: Deno.env.get('VAPID_PUBLIC_KEY'), e não Deno.env.get('chave_real...').
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("Configuração de servidor incompleta: As chaves VAPID não foram definidas nas 'secrets' da Edge Function.");
    }
    webpush.setVapidDetails('mailto:leovieiradefreitas@gmail.com', vapidPublicKey, vapidPrivateKey);

    if (notifications && Array.isArray(notifications) && notifications.length > 0) {
      // --- MODO DE NOTIFICAÇÃO DIRIGIDA (ORIGINAL) ---
      const { error: insertError } = await supabaseAdmin.from('notifications').insert(notifications);
      if (insertError) throw insertError;
      const notificationsByUser = new Map();
      notifications.forEach((n)=>{
        if (!notificationsByUser.has(n.user_id)) notificationsByUser.set(n.user_id, []);
        notificationsByUser.get(n.user_id)?.push(n);
      });
      const userIds = Array.from(notificationsByUser.keys());
      const { data: subscriptions, error: subsError } = await supabaseAdmin.from('push_subscriptions').select('endpoint, subscription_data, user_id').in('user_id', userIds);
      if (subsError) throw subsError;
      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Notificações criadas, mas nenhum dispositivo para notificar.'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
      const targetedPushPromises = subscriptions.map((sub)=>{
        const userNotifications = notificationsByUser.get(sub.user_id) || [];
        const title = 'Nova Notificação do App Voluntários';
        const body = userNotifications.length > 1 ? `Você tem ${userNotifications.length} novas notificações.` : userNotifications[0]?.message ?? 'Você tem uma nova notificação.';
        let targetUrl = '/#/notifications';
        if (userNotifications.length === 1 && userNotifications[0]?.related_event_id) {
          targetUrl = '/#/events';
        }
        const payload = JSON.stringify({
          title,
          body,
          url: targetUrl
        });
        return sendPushNotifications([
          sub
        ], payload, supabaseAdmin);
      });
      await Promise.all(targetedPushPromises);
      return new Response(JSON.stringify({
        success: true,
        message: 'Notificações criadas e enviadas com sucesso.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    } else if (broadcastMessage && typeof broadcastMessage === 'string') {
      // --- MODO DE NOTIFICAÇÃO EM MASSA (NOVO) ---
      const { data: allSubscriptions, error: subsError } = await supabaseAdmin.from('push_subscriptions').select('endpoint, subscription_data');
      if (subsError) throw subsError;
      if (!allSubscriptions || allSubscriptions.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Nenhum dispositivo encontrado para enviar a notificação.'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
      const payload = JSON.stringify({
        title: 'Mensagem do Administrador',
        body: broadcastMessage,
        url: '/'
      });
      await sendPushNotifications(allSubscriptions, payload, supabaseAdmin);
      return new Response(JSON.stringify({
        success: true,
        message: `Notificação em massa enviada para ${allSubscriptions.length} dispositivo(s).`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    } else {
      return new Response(JSON.stringify({
        error: "Payload da requisição inválido. Forneça 'notifications' ou 'broadcastMessage'."
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
  } catch (error) {
    console.error('Erro na função create-notifications:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro inesperado na função.';
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});