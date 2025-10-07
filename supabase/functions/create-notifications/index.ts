// supabase/functions/create-notifications/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4';
// Using Deno's native npm specifier for better compatibility with Node.js modules.
import webpush from 'npm:web-push@3.6.7';

// Inlined CORS headers to avoid relative path issues in deployment
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

declare const Deno: any;

Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { notifications } = await req.json();
    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      throw new Error("The 'notifications' array is required in the request body.");
    }
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // 1. Insert notifications into the database.
    const { error: insertError } = await supabaseAdmin.from('notifications').insert(notifications);
    if (insertError) {
      throw insertError;
    }
    // ---- START: Optimized Push Notification Logic ----
    const notificationsByUser = new Map();
    notifications.forEach((n)=>{
      if (!notificationsByUser.has(n.user_id)) {
        notificationsByUser.set(n.user_id, []);
      }
      notificationsByUser.get(n.user_id).push(n);
    });
    const allUserIds = Array.from(notificationsByUser.keys());
    if (allUserIds.length > 0) {
      const { data: subscriptions, error: subError } = await supabaseAdmin.from('push_subscriptions').select('user_id, subscription_data, endpoint').in('user_id', allUserIds);
      if (subError) {
        console.error('Error fetching push subscriptions:', subError);
      } else if (subscriptions && subscriptions.length > 0) {
        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
        if (!vapidPublicKey || !vapidPrivateKey) {
          console.error("VAPID keys are not set. Skipping push notifications.");
        } else {
          // Set VAPID details for the web-push library
          webpush.setVapidDetails('mailto:admin@example.com', vapidPublicKey, vapidPrivateKey);
          const pushPromises = subscriptions.map(async (sub)=>{
            const userNotifications = notificationsByUser.get(sub.user_id) || [];
            const title = 'Nova Notificação do App Voluntários';
            const body = userNotifications.length > 1 ? `Você tem ${userNotifications.length} novas notificações.` : userNotifications[0]?.message || 'Você tem uma nova notificação.';
            let targetUrl = '/#/notifications';
            if (userNotifications.length === 1 && userNotifications[0].related_event_id) {
              targetUrl = '/#/events';
            }
            const payload = JSON.stringify({
              title,
              body,
              url: targetUrl
            });
            const subscriptionObject = sub.subscription_data;
            try {
              await webpush.sendNotification(subscriptionObject, payload);
            } catch (pushError) {
              console.error(`Failed to send push notification to ${sub.endpoint}:`, pushError);
              if (pushError.statusCode === 404 || pushError.statusCode === 410) {
                console.log('Subscription expired or invalid. Deleting.');
                await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
              }
            }
          });
          await Promise.all(pushPromises);
        }
      }
    }
    // ---- END: Optimized Push Notification Logic ----
    return new Response(JSON.stringify({
      success: true,
      message: 'Notifications created successfully.'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in create-notifications function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred in the function.';
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