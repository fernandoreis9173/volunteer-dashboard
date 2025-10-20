// supabase/functions/mark-attendance/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';
import * as webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const sendPushNotification = async (subscription: any, payload: string, supabaseAdmin: any) => {
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
            console.log(`Subscription for endpoint ${subscription.endpoint} has expired. Removing from DB.`);
            await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        } else {
            console.error(`Failed to send push notification to ${subscription.endpoint}:`, error.body || error.message);
        }
    }
};

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Initialize clients and get authenticated user (the leader)
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

    // 2. Get leader's profile to verify their department
    const { data: leaderProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('department_id')
      .eq('id', user.id)
      .single();

    if (profileError || !leaderProfile) {
      throw new Error('Não foi possível encontrar um perfil para o líder autenticado.');
    }

    // 3. Get data from the scanned QR code
    const { volunteerId, eventId, departmentId } = await req.json();
    if (!volunteerId || !eventId || !departmentId) {
      throw new Error('Dados do QR code inválidos. IDs de voluntário, evento e departamento são necessários.');
    }

    // 4. SECURITY CHECK: Ensure the leader is marking attendance for their own department
    if (leaderProfile.department_id !== departmentId) {
        throw new Error('Permissão negada. Você só pode marcar presença para o seu próprio departamento.');
    }

    // 5. Fetch the attendance record to check its current status
    const { data: attendanceRecord, error: fetchError } = await supabaseAdmin
        .from('event_volunteers')
        .select('present')
        .match({
            event_id: eventId,
            volunteer_id: volunteerId,
            department_id: departmentId,
        })
        .single();

    if (fetchError) {
        if (fetchError.code === 'PGRST116') { // code for "zero rows"
            throw new Error('Este voluntário não está escalado para este evento neste departamento.');
        }
        throw fetchError;
    }

    if (attendanceRecord && attendanceRecord.present === true) {
        throw new Error('Este voluntário já teve a presença confirmada.');
    }

    // 6. Update the record to mark as present
    const { error: updateError } = await supabaseAdmin
        .from('event_volunteers')
        .update({ present: true })
        .match({
            event_id: eventId,
            volunteer_id: volunteerId,
            department_id: departmentId,
        });
    
    if (updateError) throw updateError;
    
    // 7. If successful, send notification to the volunteer
    try {
        const { data: volunteerData, error: volunteerError } = await supabaseAdmin
            .from('volunteers')
            .select('user_id')
            .eq('id', volunteerId)
            .single();
        
        if (volunteerError || !volunteerData?.user_id) {
            console.error("Could not fetch volunteer user_id for notification.", { volunteerError });
            throw new Error("Dados do voluntário para notificação não encontrados.");
        }
        const userId = volunteerData.user_id;

        const { data: eventData, error: eventError } = await supabaseAdmin
            .from('events')
            .select('name')
            .eq('id', eventId)
            .single();

        if (eventError || !eventData?.name) {
            console.error("Could not fetch event name for notification.", { eventError });
            throw new Error("Dados do evento para notificação não encontrados.");
        }
        const { name: eventName } = eventData;
        const notificationMessage = `Sua presença foi confirmada no evento: "${eventName}".`;

        await supabaseAdmin.from('notifications').insert({
            user_id: userId,
            message: notificationMessage,
            type: 'info',
            related_event_id: eventId,
        });

        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

        if (!vapidPublicKey || !vapidPrivateKey) {
            console.warn("VAPID keys not set. Skipping push notification.");
        } else {
            const { data: subscriptions, error: subsError } = await supabaseAdmin
                .from('push_subscriptions')
                .select('endpoint, subscription_data')
                .eq('user_id', userId);

            if (subsError) {
                console.error('Error fetching push subscriptions:', subsError.message);
            } else if (subscriptions && subscriptions.length > 0) {
                webpush.setVapidDetails('mailto:leovieiradefreitas@gmail.com', vapidPublicKey, vapidPrivateKey);
                
                const payload = JSON.stringify({
                    title: 'Presença Confirmada!',
                    body: notificationMessage,
                    url: '/#/dashboard',
                });

                const pushPromises = subscriptions.map((sub: any) => sendPushNotification(sub, payload, supabaseAdmin));
                await Promise.all(pushPromises);
            }
        }
    } catch (notificationError) {
        console.error("Falha ao enviar notificação após marcar presença:", notificationError.message);
    }

    return new Response(JSON.stringify({ success: true, message: 'Presença marcada com sucesso.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Erro na função mark-attendance:', error);

    // If the specific error is that the volunteer is already confirmed, return a 409 Conflict status.
    // This is a client error, not a server error, and prevents retries.
    if (error.message === 'Este voluntário já teve a presença confirmada.') {
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409, // 409 Conflict
      });
    }

    // For all other errors, return a generic 500 Internal Server Error.
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});