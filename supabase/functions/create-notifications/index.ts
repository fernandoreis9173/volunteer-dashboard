// supabase/functions/create-notifications/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';
import * as webpush from 'npm:web-push@3.6.7';
// 1. DECLARAÇÃO CORRETA DE corsHeaders NO ESCOPO EXTERNO
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};
// --- NOVO: Função para envio PARALELO (rápido, para evitar timeout) ---
const sendPushNotificationsOptimized = async (subscriptions, payload, supabaseAdmin)=>{
  const pushPromises = subscriptions.map(async (sub)=>{
    try {
      const subscriptionData = typeof sub.subscription_data === 'string' ? JSON.parse(sub.subscription_data) : sub.subscription_data;
      const fullSubscription = {
        endpoint: sub.endpoint,
        keys: subscriptionData.keys
      };
      await webpush.sendNotification(fullSubscription, payload);
    } catch (error) {
      // Lógica de tratamento de falhas (remover endpoints expirados)
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.log(`Inscrição ${sub.endpoint} expirada. Removendo...`);
        await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      } else {
        console.error('Erro ao enviar push:', error.body || error.message);
      }
    }
  });
  await Promise.all(pushPromises); // Envia TUDO em paralelo e espera o fim.
};

// FIX: Declare Deno to resolve TypeScript errors for Deno-specific APIs.
declare const Deno: any;

Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders // Agora está no escopo correto
    });
  }
  try {
    const { notifications, broadcastMessage } = await req.json();
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPublicKey || !vapidPrivateKey) throw new Error("Chaves VAPID não definidas.");
    webpush.setVapidDetails('mailto:leovieiradefreitas@gmail.com', vapidPublicKey, vapidPrivateKey);
    if (notifications && Array.isArray(notifications) && notifications.length > 0) {
      // --- Inserir notificações na tabela ---
      const { error: insertError } = await supabaseAdmin.from('notifications').insert(notifications);
      if (insertError) throw insertError;
      // Mapear por usuário e obter assinaturas
      const notificationsByUser = new Map();
      notifications.forEach((n)=>{
        if (!notificationsByUser.has(n.user_id)) notificationsByUser.set(n.user_id, []);
        notificationsByUser.get(n.user_id)?.push(n);
      });
      const userIds = Array.from(notificationsByUser.keys());
      const { data: subscriptions } = await supabaseAdmin.from('push_subscriptions').select('endpoint, subscription_data, user_id').in('user_id', userIds);
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
      // --- Enviar notificações por usuário em PARALELO (Otimizado) ---
      const allTargetedPushPromises = [];
      for (const sub of subscriptions){
        const userNotifications = notificationsByUser.get(sub.user_id) || [];
        const title = 'Nova Notificação';
        const body = userNotifications.length > 1 ? `Você tem ${userNotifications.length} novas notificações.` : userNotifications[0]?.message ?? 'Você tem uma nova notificação.';
        let targetUrl = '/#/notifications';
        if (userNotifications.length === 1 && userNotifications[0]?.related_event_id) targetUrl = '/#/events';
        const payload = JSON.stringify({
          title,
          body,
          url: targetUrl
        });
        // Adiciona a Promise de envio à lista
        allTargetedPushPromises.push(sendPushNotificationsOptimized([
          sub
        ], payload, supabaseAdmin));
      }
      await Promise.all(allTargetedPushPromises); // Espera que todos os envios terminem
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
      // --- Lógica de Broadcast (Notificação em Massa) ---
      const { data: allSubscriptions, error: subsError } = await supabaseAdmin.from('push_subscriptions').select('endpoint, subscription_data, user_id');
      if (subsError) throw subsError;
      if (allSubscriptions && allSubscriptions.length > 0) {
        const payload = JSON.stringify({
          title: 'Mensagem da Administração',
          body: broadcastMessage,
          url: '/#/notifications'
        });
        // Envia para todos os dispositivos inscritos usando a função otimizada
        await sendPushNotificationsOptimized(allSubscriptions, payload, supabaseAdmin);
        // Salva a notificação no banco de dados para cada usuário
        const userIdsWithSubscriptions = [
          ...new Set(allSubscriptions.map((s)=>s.user_id))
        ];
        const broadcastNotificationsToInsert = userIdsWithSubscriptions.map((userId)=>({
            user_id: userId,
            message: broadcastMessage,
            type: 'info',
            is_read: false
          }));
        const { error: insertBroadcastError } = await supabaseAdmin.from('notifications').insert(broadcastNotificationsToInsert);
        if (insertBroadcastError) {
          // Loga o erro mas não falha a requisição, pois o push já foi enviado
          console.error("Falha ao salvar notificações de broadcast no banco de dados:", insertBroadcastError);
        }
      }
      return new Response(JSON.stringify({
        success: true,
        message: `Notificação em massa enviada para ${allSubscriptions?.length || 0} dispositivos.`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    } else {
      return new Response(JSON.stringify({
        error: "Payload inválido. Forneça 'notifications' ou 'broadcastMessage'."
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
  } catch (error) {
    console.error('Erro na função:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
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