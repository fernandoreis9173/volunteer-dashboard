// supabase/functions/create-notifications/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';
import * as webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

const sendPushNotification = async (subscription: any, payload: string, supabaseAdmin: any) => {
    // Helper to send a single notification and handle errors/expired subscriptions.
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

Deno.serve(async (req: any) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { notifications, broadcastMessage, notifyType, event } = await req.json();
        
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
        if (!vapidPublicKey || !vapidPrivateKey) throw new Error("VAPID keys are not configured.");

        webpush.setVapidDetails('mailto:leovieiradefreitas@gmail.com', vapidPublicKey, vapidPrivateKey);
        
        let notificationsToProcess: any[] = Array.isArray(notifications) ? [...notifications] : [];

        if (notifyType === 'event_created' && event) {
            console.log("Buscando todos os líderes para notificação de criação de evento...");
            const { data: leadersFromProfiles, error: profileError } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .or('role.eq.leader,role.eq.lider,role.eq.líder');

            if (profileError) throw profileError;

            let leaders = leadersFromProfiles || [];

            if (leaders.length === 0) {
                console.log("Nenhum líder encontrado em 'profiles'. Buscando no 'auth.users' como fallback.");
                const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
                if (authError) {
                    console.error("Erro ao buscar usuários do auth como fallback:", authError);
                } else {
                    leaders = authData.users
                        .filter(u => ['leader', 'lider', 'líder'].includes(u.user_metadata?.role))
                        .map(u => ({ id: u.id }));
                    console.log(`Encontrados ${leaders.length} líderes no fallback do auth.`);
                }
            } else {
                console.log(`Encontrados ${leaders.length} líderes diretamente em 'profiles'.`);
            }
            
            if (leaders.length > 0) {
                const newNotifications = leaders.map(l => ({
                    user_id: l.id,
                    message: `Novo evento: "${event.name}". Verifique se o seu departamento precisa participar.`,
                    type: 'new_event_for_leader',
                    related_event_id: event.id,
                }));
                notificationsToProcess.push(...newNotifications);
            } else {
                console.log("⚠️ Nenhum líder encontrado para receber notificação de criação de evento.");
            }
        } else if (notifyType === 'event_updated' && event) {
            const { data: deptsFromAssoc, error: edError } = await supabaseAdmin.from('event_departments').select('department_id').eq('event_id', event.id);
            const { data: deptsFromVols, error: evError } = await supabaseAdmin.from('event_volunteers').select('department_id').eq('event_id', event.id);

            if (edError || evError) {
                console.error("Error fetching depts for update notification:", edError || evError);
            } else {
                const deptIdsFromAssoc = deptsFromAssoc?.map(d => d.department_id) || [];
                const deptIdsFromVols = deptsFromVols?.map(d => d.department_id) || [];
                const allDepartmentIds = [...new Set([...deptIdsFromAssoc, ...deptIdsFromVols])];

                if (allDepartmentIds.length > 0) {
                    console.log(`Buscando líderes dos departamentos [${allDepartmentIds.join(', ')}] para notificação de atualização.`);
                    // FIX: Query the correct table `department_leaders` to find leaders by `department_id`.
                    const { data: leadersData, error: leaderError } = await supabaseAdmin
                        .from('department_leaders')
                        .select('leader_id')
                        .in('department_id', allDepartmentIds);
                    
                    if (leaderError) throw leaderError;
                    
                    const leaders = leadersData || [];
                    
                    if (leaders.length > 0) {
                        // FIX: Use `leader_id` from the correct query result.
                        const newNotifications = leaders.map(l => ({
                            user_id: l.leader_id,
                            message: `O evento "${event.name}", do qual seu departamento participa, foi alterado. Verifique as mudanças.`,
                            type: 'event_update',
                            related_event_id: event.id,
                        }));
                        notificationsToProcess.push(...newNotifications);
                    }
                }
            }
            // --- UNIFIED VOLUNTEER NOTIFICATION LOGIC ---
            console.log(`Buscando voluntários escalados no evento ${event.id} para notificação de atualização.`);
            const { data: eventVolunteers, error: evNotifyError } = await supabaseAdmin
                .from('event_volunteers')
                .select('volunteers(user_id)')
                .eq('event_id', event.id);

            if (evNotifyError) {
                console.error("Erro ao buscar voluntários do evento para notificação:", evNotifyError);
            } else if (eventVolunteers && eventVolunteers.length > 0) {
                const notifiedVolunteerUserIds = new Set<string>();
                const volunteerNotifications = eventVolunteers
                    .map(ev => (Array.isArray(ev.volunteers) ? ev.volunteers[0] : ev.volunteers)?.user_id)
                    .filter((userId): userId is string => {
                        if (userId && !notifiedVolunteerUserIds.has(userId)) {
                            notifiedVolunteerUserIds.add(userId);
                            return true;
                        }
                        return false;
                    })
                    .map(userId => ({
                        user_id: userId,
                        message: `O evento "${event.name}" em que você está escalado foi alterado. Verifique as mudanças.`,
                        type: 'event_update',
                        related_event_id: event.id,
                    }));
                
                console.log(`Encontrados ${volunteerNotifications.length} voluntários únicos para notificar.`);
                notificationsToProcess.push(...volunteerNotifications);
            }
        }

        if (notificationsToProcess && notificationsToProcess.length > 0) {
            console.log("🔔 Notificações geradas:", notificationsToProcess.map(n => ({
              user_id: n.user_id,
              message: n.message
            })));

            const { error: insertError } = await supabaseAdmin.from('notifications').insert(notificationsToProcess);
            if (insertError) throw insertError;

            const notificationsByUser = new Map();
            notificationsToProcess.forEach(n => {
                if (!notificationsByUser.has(n.user_id)) notificationsByUser.set(n.user_id, []);
                notificationsByUser.get(n.user_id)?.push(n);
            });
            const userIdsToNotify = Array.from(notificationsByUser.keys());

            const { data: activeSubscriptions, error: subsError } = await supabaseAdmin
                .from('push_subscriptions')
                .select('endpoint, subscription_data, user_id')
                .in('user_id', userIdsToNotify);
            
            if (subsError) {
                console.error("Error fetching push subscriptions, push notifications will be skipped:", subsError);
            }
            
            if (activeSubscriptions) {
                console.log("📡 IDs com subscription ativa:", activeSubscriptions.map(s => s.user_id));
            }

            if (activeSubscriptions && activeSubscriptions.length > 0) {
                console.log(`Found ${activeSubscriptions.length} active subscriptions for ${userIdsToNotify.length} targeted users.`);

                const pushPromises = activeSubscriptions.map(sub => {
                    const userNotifications = notificationsByUser.get(sub.user_id) || [];
                    const title = 'Nova Notificação';
                    const body = userNotifications.length > 1 
                        ? `Você tem ${userNotifications.length} novas notificações.` 
                        : userNotifications[0]?.message ?? 'Você tem uma nova notificação.';
                    
                    let targetUrl = '/#/notifications';
                    if (userNotifications.length === 1 && userNotifications[0]?.related_event_id) {
                        targetUrl = '/#/events';
                    }

                    const payload = JSON.stringify({ title, body, url: targetUrl });
                    return sendPushNotification(sub, payload, supabaseAdmin);
                });
                
                await Promise.all(pushPromises);
            } else {
                 console.log(`Notifications saved to DB, but no active push subscriptions found for the targeted users.`);
            }

            return new Response(JSON.stringify({
                success: true,
                message: `Notifications created. Attempted to send push to ${activeSubscriptions?.length || 0} devices.`
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

        } else if (broadcastMessage && typeof broadcastMessage === 'string') {
            const { data: allSubscriptions, error: subsError } = await supabaseAdmin
                .from('push_subscriptions')
                .select('endpoint, subscription_data, user_id');

            if (subsError) throw subsError;

            if (allSubscriptions && allSubscriptions.length > 0) {
                const payload = JSON.stringify({
                    title: 'Mensagem da Administração',
                    body: broadcastMessage,
                    url: '/#/notifications'
                });
                
                const broadcastPromises = allSubscriptions.map(sub => sendPushNotification(sub, payload, supabaseAdmin));
                await Promise.all(broadcastPromises);

                const userIdsWithSubscriptions = [...new Set(allSubscriptions.map(s => s.user_id))];
                const broadcastNotificationsToInsert = userIdsWithSubscriptions.map(userId => ({
                    user_id: userId,
                    message: broadcastMessage,
                    type: 'info' as const,
                    is_read: false,
                }));

                if(broadcastNotificationsToInsert.length > 0) {
                    await supabaseAdmin.from('notifications').insert(broadcastNotificationsToInsert);
                }
                
                return new Response(JSON.stringify({ message: `Broadcast enviado para ${allSubscriptions.length} inscrições.` }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                });
            } else {
                 return new Response(JSON.stringify({ message: 'Nenhuma inscrição de push ativa encontrada para o broadcast.' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                });
            }
        }

        return new Response(JSON.stringify({ message: 'Nenhuma notificação para processar.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error('Erro na função create-notifications:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});