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
        const { notifications, broadcastMessage } = await req.json();
        
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
        if (!vapidPublicKey || !vapidPrivateKey) throw new Error("VAPID keys are not configured.");

        webpush.setVapidDetails('mailto:leovieiradefreitas@gmail.com', vapidPublicKey, vapidPrivateKey);

        if (notifications && Array.isArray(notifications) && notifications.length > 0) {
            // Step 1: Save notifications to the database for all targeted users.
            const { error: insertError } = await supabaseAdmin.from('notifications').insert(notifications);
            if (insertError) throw insertError;

            // Group notifications by user to create tailored push messages.
            const notificationsByUser = new Map();
            notifications.forEach(n => {
                if (!notificationsByUser.has(n.user_id)) notificationsByUser.set(n.user_id, []);
                notificationsByUser.get(n.user_id)?.push(n);
            });
            const userIdsToNotify = Array.from(notificationsByUser.keys());

            // Step 2: Query for active push subscriptions. This is the key step.
            // It filters the user list, ensuring we only attempt to send pushes
            // to users who have opted in. This prevents errors for users without subscriptions.
            const { data: activeSubscriptions, error: subsError } = await supabaseAdmin
                .from('push_subscriptions')
                .select('endpoint, subscription_data, user_id')
                .in('user_id', userIdsToNotify);
            
            if (subsError) {
                console.error("Error fetching push subscriptions, push notifications will be skipped:", subsError);
            }

            if (activeSubscriptions && activeSubscriptions.length > 0) {
                console.log(`Found ${activeSubscriptions.length} active subscriptions for ${userIdsToNotify.length} targeted users.`);

                // Step 3: Send push notifications in parallel ONLY to active subscriptions.
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
                    is_read: false
                }));
                
                await supabaseAdmin.from('notifications').insert(broadcastNotificationsToInsert);
            }
            return new Response(JSON.stringify({
                success: true,
                message: `Broadcast sent to ${allSubscriptions?.length || 0} devices.`
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        } else {
            return new Response(JSON.stringify({ error: "Invalid payload." }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error('Critical error in create-notifications function:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
