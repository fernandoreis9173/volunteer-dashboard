
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Consultar jobs do pg_cron
        const { data, error } = await supabase.rpc('get_cron_jobs')

        if (error) {
            // Se a RPC não existir, tentar query direta via SQL function se possível, 
            // mas como não podemos criar RPCs facilmente aqui sem SQL, vamos tentar uma abordagem diferente.
            // Vamos tentar executar SQL direto via uma função que talvez exista ou assumir que precisamos criar uma.
            // Mas espere, eu posso usar a API de SQL se estiver habilitada, mas geralmente não está.

            // Vamos tentar listar usando uma query direta se tivermos permissão, mas 'cron.job' geralmente requer superuser ou acesso especial.
            // Vamos tentar uma abordagem mais simples: Listar as Edge Functions e ver se alguma tem nome suspeito que eu perdi.
            throw error;
        }

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
