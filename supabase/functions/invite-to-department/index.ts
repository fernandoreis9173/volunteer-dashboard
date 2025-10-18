// supabase/functions/invite-to-department/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';
import * as webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const sendPushNotification = async (subscription: any, payload: string, supabaseAdmin: any) => {
    // Helper para enviar uma notificação e lidar com inscrições expiradas.
    try {
        const subscriptionData = typeof subscription.subscription_data === 'string' 
            ? JSON.parse(subscription.subscription_data) 
            : subscription.subscription_data;
            
        const fullSubscription = {
            endpoint: subscription.endpoint,
            keys: subscriptionData.keys,
        };

        await webpush.sendNotification(fullSubscription, payload);
    } catch (error) {
        if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`Inscrição para o endpoint ${subscription.endpoint} expirou. Removendo do BD.`);
            await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        } else {
            console.error(`Falha ao enviar notificação push para ${subscription.endpoint}:`, error.body || error.message);
        }
    }
};

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Inicializar clientes e obter usuário autenticado (o líder)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('A configuração do Supabase está ausente.');
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Falha na autenticação.');

    // 2. Obter o departamento do líder
    const { data: leaderProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('department_id')
      .eq('id', user.id)
      .single();
    if (profileError || !leaderProfile || !leaderProfile.department_id) {
      throw new Error('Não foi possível encontrar um departamento associado a este líder.');
    }

    // 3. Obter o ID do voluntário da requisição e buscar os dados do voluntário
    const { volunteerId } = await req.json();
    if (!volunteerId) throw new Error('O ID do voluntário é obrigatório.');
    
    const { data: volunteer, error: volunteerError } = await supabaseAdmin
      .from('volunteers')
      .select('id, user_id, name, departaments')
      .eq('id', volunteerId)
      .single();
    
    if (volunteerError) throw volunteerError;
    if (!volunteer) throw new Error('Voluntário não encontrado.');

    // 4. Buscar o nome do departamento para verificações e notificações
    const { data: department, error: deptError } = await supabaseAdmin
        .from('departments')
        .select('name')
        .eq('id', leaderProfile.department_id)
        .single();
    if(deptError || !department) throw new Error('Não foi possível encontrar o nome do departamento.');
    
    // 5. Verificar se o voluntário já está no departamento
    const volunteerDepartments = Array.isArray(volunteer.departaments) ? volunteer.departaments : [];
    if(volunteerDepartments.includes(department.name)) {
        throw new Error(`Voluntário(a) ${volunteer.name} já pertence a este departamento.`);
    }

    // 6. Verificar se já existe um convite pendente
    const { data: existingInvite, error: existingInviteError } = await supabaseAdmin
        .from('invitations')
        .select('id')
        .eq('volunteer_id', volunteerId)
        .eq('department_id', leaderProfile.department_id)
        .eq('status', 'pendente')
        .maybeSingle();

    if (existingInviteError) throw existingInviteError;
    if (existingInvite) throw new Error('Um convite para este voluntário já está pendente.');

    // 7. Criar o convite
    const { error: insertError } = await supabaseAdmin.from('invitations').insert({
      leader_id: user.id,
      volunteer_id: volunteerId,
      department_id: leaderProfile.department_id,
      status: 'pendente'
    });
    if (insertError) throw insertError;

    // 8. Criar e enviar notificação para o voluntário (LÓGICA INTEGRADA)
    if (volunteer.user_id) {
      const leaderName = user.user_metadata?.name || 'Um líder';
      const notificationMessage = `${leaderName} convidou você para se juntar ao departamento "${department.name}".`;
      
      // 8a. Inserir no BD (para toast e histórico)
      const { error: dbNotificationError } = await supabaseAdmin.from('notifications').insert({
        user_id: volunteer.user_id,
        message: notificationMessage,
        type: 'invitation_received',
      });

      if (dbNotificationError) {
        console.error('Falha ao salvar a notificação do convite no BD:', dbNotificationError);
      }

      // 8b. Enviar notificação push
      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
      if (!vapidPublicKey || !vapidPrivateKey) {
        console.error("Chaves VAPID não configuradas. Pulando notificação push.");
      } else {
        webpush.setVapidDetails('mailto:leovieiradefreitas@gmail.com', vapidPublicKey, vapidPrivateKey);

        const { data: subscriptions, error: subsError } = await supabaseAdmin
          .from('push_subscriptions')
          .select('endpoint, subscription_data')
          .eq('user_id', volunteer.user_id);

        if (subsError) {
          console.error('Erro ao buscar inscrições push:', subsError);
        } else if (subscriptions && subscriptions.length > 0) {
          const payload = JSON.stringify({
            title: 'Novo Convite',
            body: notificationMessage,
            url: '/#/notifications',
          });

          const pushPromises = subscriptions.map(sub => sendPushNotification(sub, payload, supabaseAdmin));
          await Promise.all(pushPromises);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Convite enviado!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Erro na função invite-to-department:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
