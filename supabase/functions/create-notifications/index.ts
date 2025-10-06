// supabase/functions/create-notifications/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4';
import { corsHeaders } from '../_shared/cors.ts';
import webpush from 'https://esm.sh/web-push@3.6.7';
Deno.serve(async (req)=>{
  // Lida com as requisições de preflight do CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { notifications } = await req.json();
    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      throw new Error("O array 'notifications' é obrigatório no corpo da requisição.");
    }
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // 1. Insere as notificações no banco de dados.
    const { error: insertError } = await supabaseAdmin.from('notifications').insert(notifications);
    if (insertError) {
      throw insertError;
    }
    // ---- INÍCIO: Lógica Otimizada de Notificação Push ----
    // 2. Agrupa as notificações por usuário.
    const notificationsByUser = new Map();
    notifications.forEach((n)=>{
      if (!notificationsByUser.has(n.user_id)) {
        notificationsByUser.set(n.user_id, []);
      }
      notificationsByUser.get(n.user_id).push(n);
    });
    const allUserIds = Array.from(notificationsByUser.keys());
    if (allUserIds.length > 0) {
      // 3. Busca todas as inscrições para todos os usuários de uma só vez.
      const { data: subscriptions, error: subError } = await supabaseAdmin.from('push_subscriptions').select('user_id, subscription_data, endpoint').in('user_id', allUserIds);
      if (subError) {
        console.error('Erro ao buscar inscrições push:', subError);
      // Não lança erro, apenas loga. A notificação principal no DB já foi salva.
      } else if (subscriptions && subscriptions.length > 0) {
        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
        if (!vapidPublicKey || !vapidPrivateKey) {
          console.error("As chaves VAPID não estão configuradas. Pulando notificações push.");
        } else {
          const options = {
            vapidDetails: {
              subject: "mailto:admin@example.com",
              publicKey: vapidPublicKey,
              privateKey: vapidPrivateKey
            }
          };
          // 4. Cria um array de promessas para enviar todas as notificações em paralelo.
          const pushPromises = subscriptions.map(async (sub)=>{
            const userNotifications = notificationsByUser.get(sub.user_id);
            const title = 'Nova Notificação do App Voluntários';
            const body = userNotifications.length > 1 ? `Você tem ${userNotifications.length} novas notificações.` : userNotifications[0].message;
            let targetUrl = '/#/notifications';
            if (userNotifications.length === 1 && userNotifications[0].related_event_id) {
              targetUrl = '/#/events';
            }
            const payload = JSON.stringify({
              title,
              body,
              url: targetUrl
            });
            const subscription = sub.subscription_data;
            try {
              await webpush.sendNotification(subscription, payload, options);
            } catch (pushError) {
              console.error(`Falha ao enviar notificação push para ${sub.endpoint}:`, pushError);
              if (pushError.statusCode === 404 || pushError.statusCode === 410) {
                console.log('Inscrição expirou. Deletando.');
                await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
              }
            }
          });
          // 5. Aguarda a conclusão de todos os envios.
          await Promise.all(pushPromises);
        }
      }
    }
    // ---- FIM: Lógica Otimizada de Notificação Push ----
    return new Response(JSON.stringify({
      success: true,
      message: 'Notificações criadas com sucesso.'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
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
