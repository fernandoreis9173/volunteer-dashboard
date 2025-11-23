import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Edge Function: Limpeza Automática de Índices Não Utilizados
 * =============================================================
 * 
 * Esta função é executada periodicamente (via cron) para:
 * 1. Verificar índices não utilizados no banco de dados
 * 2. Gerar relatórios de saúde
 * 3. Opcional: Remover índices não utilizados automaticamente
 * 
 * AGENDAMENTO SUGERIDO:
 * - Primeira semana: Modo relatório (dry_run=true)
 * - Após validação: Modo automático (dry_run=false)
 * - Frequência: 1x por mês
 * 
 * COMO AGENDAR:
 * Use o Cron schedule do Supabase:
 * - Ir em Edge Functions > Configure
 * - Adicionar: 0 0 1 * * (todo dia 1 do mês às 00:00)
 */

serve(async (req) => {
    try {
        // Verificar segredo para evitar execuções não autorizadas
        const authHeader = req.headers.get('Authorization');
        if (authHeader !== `Bearer ${Deno.env.get('CLEANUP_SECRET')}`) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Conectar ao banco como admin
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Gerar relatório de saúde
        const { data: healthReport, error: healthError } = await supabaseAdmin
            .rpc('index_health_report');

        if (healthError) throw healthError;

        // 2. Listar índices não utilizados
        const { data: unusedIndexes, error: unusedError } = await supabaseAdmin
            .rpc('get_unused_indexes', { min_age_days: 90 });

        if (unusedError) throw unusedError;

        // 3. Executar limpeza (modo configurável)
        const dryRun = Deno.env.get('CLEANUP_DRY_RUN') !== 'false'; // Por padrão é dry_run

        const { data: cleanupResults, error: cleanupError } = await supabaseAdmin
            .rpc('cleanup_unused_indexes', {
                dry_run: dryRun,
                min_age_days: 90
            });

        if (cleanupError) throw cleanupError;

        // 4. Preparar resposta
        const response = {
            timestamp: new Date().toISOString(),
            mode: dryRun ? 'DRY RUN (Simulação)' : 'PRODUÇÃO (Deletando)',
            health_report: healthReport,
            unused_indexes_found: unusedIndexes?.length || 0,
            unused_indexes: unusedIndexes,
            cleanup_results: cleanupResults,
            summary: {
                indexes_analyzed: cleanupResults?.length || 0,
                indexes_deleted: cleanupResults?.filter((r: any) => r.action === 'DELETED').length || 0,
                space_freed: cleanupResults
                    ?.filter((r: any) => r.action === 'DELETED')
                    .map((r: any) => r.size_freed)
                    .join(', ') || 'N/A'
            }
        };

        // 5. Opcional: Enviar notificação se algo foi deletado
        if (!dryRun && response.summary.indexes_deleted > 0) {
            // Aqui você pode adicionar lógica para enviar email/notificação
            console.log(`[IMPORTANTE] ${response.summary.indexes_deleted} índices foram removidos!`);
        }

        return new Response(
            JSON.stringify(response, null, 2),
            {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            }
        );

    } catch (error) {
        console.error('Erro na limpeza de índices:', error);
        return new Response(
            JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString()
            }),
            {
                headers: { 'Content-Type': 'application/json' },
                status: 500
            }
        );
    }
});
