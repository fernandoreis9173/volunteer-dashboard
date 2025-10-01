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
    
    // 1. Fetch user to get existing metadata
    const { data: { user: existingUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getUserError) throw getUserError;
    if (!existingUser) throw new Error(`User with ID ${userId} not found.`);

    // 2. Safely merge existing metadata with new data
    const existingMetadata = (typeof existingUser.user_metadata === 'object' && existingUser.user_metadata !== null)
      ? existingUser.user_metadata
      : {};
    const newMetadata = { 
        ...existingMetadata, 
        role: role,
        page_permissions: permissions
    };
    
    // 3. Update the user with merged metadata
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        userId, 
        {
          user_metadata: newMetadata
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
