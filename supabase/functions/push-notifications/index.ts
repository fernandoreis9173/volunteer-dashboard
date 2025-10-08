// supabase/functions/push-notifications/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';
import * as webpush from 'npm:web-push@3.6.7';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

declare const Deno: any;

Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { subscription, user_id, notifications } = await req.json();
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // --- 1. Salvar subscription (se enviada) ---
    if (subscription?.endpoint && user_id) {
      const subscriptionData = {
        user_id,
        endpoint: subscription.endpoint,
        subscription_data: subscription
      };
      const { error: subError } = await supabaseAdmin.from('push_subscriptions').upsert(subscriptionData, {
        onConflict: 'endpoint'
      });
      // If saving the subscription fails, throw an error to notify the client.
      if (subError) {
        console.error('Falha ao salvar subscription dentro de push-notifications:', subError);
        throw subError;
      }
    }
    // --- 2. Inserir e Enviar notificações (se enviadas) ---
    if (Array.isArray(notifications) && notifications.length > 0) {
      const { error: insertError } = await supabaseAdmin.from('notifications').insert(notifications);
      if (insertError) throw insertError;
      // --- 3. Enviar push notifications ---
      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
      if (vapidPublicKey && vapidPrivateKey) {
        webpush.setVapidDetails('mailto:leovieiradefreitas@gmail.com', vapidPublicKey, vapidPrivateKey);
        const notificationsByUser = new Map();
        notifications.forEach((n)=>{
          if (!notificationsByUser.has(n.user_id)) notificationsByUser.set(n.user_id, []);
          notificationsByUser.get(n.user_id)?.push(n);
        });
        const userIds = Array.from(notificationsByUser.keys());
        const { data: subscriptions } = await supabaseAdmin.from('push_subscriptions').select('endpoint, subscription_data, user_id').in('user_id', userIds);
        if (subscriptions?.length) {
          const pushPromises = subscriptions.map(async (sub)=>{
            try {
              const subData = typeof sub.subscription_data === 'string' ? JSON.parse(sub.subscription_data) : sub.subscription_data;
              const userNotifs = notificationsByUser.get(sub.user_id) || [];
              const title = 'Nova Notificação do App Voluntários';
              const body = userNotifs.length > 1 ? `Você tem ${userNotifs.length} novas notificações.` : userNotifs[0]?.message ?? 'Você tem uma nova notificação.';
              const url = userNotifs.length === 1 && userNotifs[0]?.related_event_id ? '/#/events' : '/#/notifications';
              const payload = JSON.stringify({
                title,
                body,
                url
              });
              await webpush.sendNotification(subData, payload);
            } catch (err) {
              if (err.statusCode === 410 || err.statusCode === 404) {
                console.log(`Inscrição expirada: ${sub.endpoint}. Removendo...`);
                await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
              } else {
                console.error('Falha ao enviar push:', err.body || err.message);
              }
            }
          });
          await Promise.all(pushPromises);
        }
      } else {
        console.warn('VAPID keys ausentes. Push notifications não foram enviadas.');
      }
    }
    return new Response(JSON.stringify({
      success: true,
      message: 'Operação concluída.'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Erro na função push-notifications:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro inesperado.';
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