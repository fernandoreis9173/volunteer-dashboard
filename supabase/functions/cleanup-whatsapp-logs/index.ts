import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Calcular data de 30 dias atrás
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - 30);

        console.log(`Iniciando limpeza de logs anteriores a ${dateLimit.toISOString()}`);

        const { error, count } = await supabaseClient
            .from('whatsapp_logs')
            .delete({ count: 'exact' })
            .lt('created_at', dateLimit.toISOString())

        if (error) throw error

        console.log(`Limpeza concluída. ${count} registros removidos.`);

        return new Response(
            JSON.stringify({ success: true, deleted_count: count, message: `Logs anteriores a 30 dias removidos com sucesso.` }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        console.error('Erro na limpeza de logs:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
