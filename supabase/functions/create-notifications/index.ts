// supabase/functions/create-notifications/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';
import * as webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// FIX: Declare Deno to resolve TypeScript errors for Deno-specific APIs.
declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { notifications } = await req.json();

    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      return new Response(JSON.stringify({ error: "O array 'notifications' é obrigatório." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Inserir notificações no banco
    const { error: insertError } = await supabaseAdmin.from('notifications').insert(notifications);
    if (insertError) throw insertError;

    // Carregar e validar VAPID keys
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      // Lança um erro claro se as chaves não estiverem configuradas.
      // Isso garante que o problema de configuração seja visível no lado do cliente.
      throw new Error("Configuração de servidor incompleta: As chaves VAPID (VAPID_PUBLIC_KEY e/ou VAPID_PRIVATE_KEY) não foram definidas nas 'secrets' da Edge Function no painel do Supabase.");
    }

    webpush.setVapidDetails('mailto:leovieiradefreitas@gmail.com', vapidPublicKey, vapidPrivateKey);

    // Agrupar notificações por usuário
    const notificationsByUser = new Map<string, any[]>();
    notifications.forEach(n => {
      if (!notificationsByUser.has(n.user_id)) notificationsByUser.set(n.user_id, []);
      notificationsByUser.get(n.user_id)?.push(n);
    });

    const userIds = Array.from(notificationsByUser.keys());

    // Buscar subscriptions
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, subscription_data, user_id')
      .in('user_id', userIds);

    if (subsError) throw subsError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Notificações criadas, mas nenhum dispositivo encontrado para notificar.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Enviar notificações push
    const pushPromises = subscriptions.map(async (sub) => {
      try {
        const subscriptionData = typeof sub.subscription_data === 'string'
          ? JSON.parse(sub.subscription_data)
          : sub.subscription_data;
          
        // Reconstruir o objeto de inscrição completo para garantir que o endpoint esteja presente.
        const fullSubscription = {
            endpoint: sub.endpoint,
            keys: subscriptionData.keys,
        };

        const userNotifications = notificationsByUser.get(sub.user_id) || [];

        const title = 'Nova Notificação do App Voluntários';
        const body = userNotifications.length > 1
          ? `Você tem ${userNotifications.length} novas notificações.`
          : (userNotifications[0]?.message ?? 'Você tem uma nova notificação.');
        
        let targetUrl = '/#/notifications';
        if (userNotifications.length === 1 && userNotifications[0]?.related_event_id) {
          targetUrl = '/#/events';
        }

        const payload = JSON.stringify({ title, body, url: targetUrl });

        await webpush.sendNotification(fullSubscription, payload);

      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`Inscrição ${sub.endpoint} expirada. Removendo...`);
          await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } else {
          console.error('Falha ao enviar push notification:', error.body || error.message);
        }
      }
    });

    await Promise.all(pushPromises);

    return new Response(JSON.stringify({
      success: true,
      message: 'Notificações criadas e enviadas com sucesso.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('Erro na função create-notifications:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro inesperado na função.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});