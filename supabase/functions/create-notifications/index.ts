// supabase/functions/create-notifications/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';
// MANTIDO: O Deno/VSCode vai reclamar disso, mas é a sintaxe mais robusta para Node.js Push.
import * as webpush from 'npm:web-push@3.6.7'; 

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

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

    // 1. Inserir as notificações no banco de dados.
    const { error: insertError } = await supabaseAdmin.from('notifications').insert(notifications);
    if (insertError) {
      throw insertError;
    }

    // --- LÓGICA DE PUSH NOTIFICATION CORRIGIDA E RESTAURADA ---

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn("VAPID keys não configuradas. Pulando envio de push notifications.");
      return new Response(JSON.stringify({ success: true, message: 'Notificações criadas, mas envio de push pulado (VAPID keys ausentes).' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    // Configuração VAPID
    (webpush as any).setVapidDetails( // FORÇANDO 'any' para evitar erro de TS com importação npm:
      'mailto:leovieiradefreitas@gmail.com', // Substitua pelo seu e-mail
      vapidPublicKey,
      vapidPrivateKey
    );

    // 2. Agrupar notificações por usuário (Lógica Restaurada)
    const notificationsByUser = new Map<string, any[]>();
    notifications.forEach((n: any) => {
        if (!notificationsByUser.has(n.user_id)) {
            notificationsByUser.set(n.user_id, []);
        }
        notificationsByUser.get(n.user_id)!.push(n);
    });

    const userIds = Array.from(notificationsByUser.keys());

    // 3. Buscar as inscrições de push para todos os usuários a serem notificados.
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, subscription_data, user_id') // Adicionado user_id
      .in('user_id', userIds);

    if (subsError) throw subsError;
    if (!subscriptions || subscriptions.length === 0) {
       return new Response(JSON.stringify({ success: true, message: 'Notificações criadas, mas nenhum dispositivo encontrado para notificar.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    // 4. Enviar as notificações.
    const pushPromises = subscriptions.map(sub => {
      // Usar o user_id da subscrição para encontrar as notificações corretas
      const userNotifications = notificationsByUser.get(sub.user_id) || []; 
      
      const title = 'Nova Notificação do App Voluntários';
      const body = userNotifications.length > 1 
                   ? `Você tem ${userNotifications.length} novas notificações.` 
                   : userNotifications[0]?.message || 'Você tem uma nova notificação.';
      
      let targetUrl = '/#/notifications';
      if (userNotifications.length === 1 && userNotifications[0].related_event_id) {
        targetUrl = '/#/events';
      }

      const payload = JSON.stringify({ title, body, url: targetUrl });
      
      return (webpush as any).sendNotification(sub.subscription_data, payload) // FORÇANDO 'any'
        .catch(async (error: any) => { // FORÇANDO 'any'
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`Inscrição ${sub.endpoint} expirada. Removendo...`);
            await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          } else {
            console.error('Falha ao enviar push notification:', error.body || error.message);
          }
        });
    });

    await Promise.all(pushPromises);

    return new Response(JSON.stringify({ success: true, message: 'Notificações criadas e enviadas com sucesso.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Erro na função create-notifications:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro inesperado na função.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});