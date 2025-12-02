// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        if (!supabaseUrl) {
            throw new Error('Missing SUPABASE_URL')
        }

        // Tentar usar Service Role Key, fallback para Anon Key + Auth Header
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        let supabaseClient;

        if (serviceRoleKey) {
            console.log('Using Service Role Key')
            supabaseClient = createClient(supabaseUrl, serviceRoleKey)
        } else {
            console.log('Using User Context (Anon Key + Auth Header)')
            const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
            const authHeader = req.headers.get('Authorization')

            if (!anonKey || !authHeader) {
                throw new Error('Missing credentials (Service Role or Auth Header)')
            }

            supabaseClient = createClient(supabaseUrl, anonKey, {
                global: { headers: { Authorization: authHeader } }
            })
        }

        // Parse request body
        let body;
        try {
            body = await req.json()
        } catch (e) {
            throw new Error('Invalid JSON body')
        }

        const { groupId, avatarUrl } = body

        if (!groupId || !avatarUrl) {
            throw new Error('Missing groupId or avatarUrl')
        }

        console.log(`Processing update for group ${groupId}`)

        // 1. Buscar o whatsapp_group_id
        const { data: group, error: groupError } = await supabaseClient
            .from('whatsapp_groups')
            .select('whatsapp_group_id')
            .eq('id', groupId)
            .single()

        if (groupError || !group) {
            console.error('Group fetch error:', groupError)
            throw new Error('Group not found or database error: ' + (groupError?.message || 'Unknown'))
        }

        // 2. Buscar configurações da API
        const { data: settings, error: settingsError } = await supabaseClient
            .from('whatsapp_settings')
            .select('session_name, token, evolution_url')
            .single()

        if (settingsError || !settings) {
            console.error('Settings fetch error:', settingsError)
            throw new Error('WhatsApp settings not found: ' + (settingsError?.message || 'Unknown'))
        }

        // 3. Chamar Evolution API
        // Remover barra final da URL se existir
        const baseUrl = settings.evolution_url.replace(/\/$/, '')
        const apiUrl = `${baseUrl}/group/updateGroupPicture/${settings.session_name}`
        console.log(`Updating group icon via ${apiUrl}`)

        const response = await fetch(apiUrl, {
            method: 'POST', // Tentar POST primeiro (algumas docs dizem PUT)
            headers: {
                'Content-Type': 'application/json',
                'apikey': settings.token
            },
            body: JSON.stringify({
                groupJid: group.whatsapp_group_id,
                image: avatarUrl
            })
        })

        // Tentar ler a resposta da API, mesmo se não for JSON
        let result;
        const responseText = await response.text();
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            result = { raw: responseText };
        }

        console.log('Evolution API Result:', result)

        if (!response.ok) {
            return new Response(JSON.stringify({
                success: false,
                error: result,
                statusCode: response.status
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200, // Retornar 200 para o frontend tratar o erro graciosamente
            })
        }

        return new Response(JSON.stringify({ success: true, apiResult: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Function Critical Error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
