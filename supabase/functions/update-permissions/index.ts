import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4'
import { corsHeaders } from '../_shared/cors.ts';

// FIX: Declare Deno to resolve TypeScript errors for Deno-specific APIs
// like Deno.serve and Deno.env when type definitions are not automatically recognized.
declare const Deno: any;

Deno.serve(async (req) => {
  // This is needed to handle CORS preflight requests.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Correctly destructure all expected properties from the request body.
    const { userId, role, permissions } = await req.json()

    // Validate that required data is present
    if (!userId || !role || !permissions) {
        throw new Error('Missing required fields: userId, role, and permissions are required.')
    }

    // Create a Supabase admin client using environment variables.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Update the user with the role and permissions provided from the frontend.
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        userId, 
        {
          user_metadata: { 
            role: role,
            page_permissions: permissions // Use the permissions from the request body.
          }
        }
    );

    if (error) {
      throw error
    }

    return new Response(JSON.stringify({ user: data.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
