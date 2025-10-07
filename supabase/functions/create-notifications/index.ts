// supabase/functions/create-notifications/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';
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

    // --- LÓGICA DE PUSH NOTIFICATION RESTAURADA ---
    
    // 2. Obter os VAPID keys das variáveis de ambiente.
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn("VAPID keys não configuradas. Pulando envio de push notifications.");
      return new Response(JSON.stringify({ success: true, message: 'Notificações criadas, mas envio de push pulado (VAPID keys ausentes).' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    webpush.setVapidDetails(
      'mailto:your-email@example.com', // Substitua pelo seu e-mail de contato
      vapidPublicKey,
      vapidPrivateKey
    );

    // 3. Buscar as inscrições de push para todos os usuários a serem notificados.
    const userIds = [...new Set(notifications.map((n: any) => n.user_id))];
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, subscription_data')
      .in('user_id', userIds);

    if (subsError) throw subsError;
    if (!subscriptions || subscriptions.length === 0) {
       return new Response(JSON.stringify({ success: true, message: 'Notificações criadas, mas nenhum dispositivo encontrado para notificar.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    // 4. Enviar as notificações.
    const pushPromises = subscriptions.map(sub => {
      const payload = JSON.stringify({
        title: "Nova Notificação",
        body: notifications.find((n: any) => userIds.includes(n.user_id))?.message || "Você tem uma nova atualização.",
      });

      return webpush.sendNotification(sub.subscription_data, payload)
        .catch(async (error) => {
          // Se a inscrição expirou (410 Gone), remove do banco de dados.
          if (error.statusCode === 410) {
            console.log(`Inscrição ${sub.endpoint} expirada. Removendo...`);
            await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          } else {
            console.error('Falha ao enviar push notification:', error.body);
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
