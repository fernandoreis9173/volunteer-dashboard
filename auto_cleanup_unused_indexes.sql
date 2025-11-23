-- ============================================================================
-- SISTEMA AUTOMÁTICO DE LIMPEZA DE ÍNDICES NÃO UTILIZADOS
-- ============================================================================
-- Criado: 2025-11-23
-- Objetivo: Identificar e remover automaticamente índices que nunca foram 
--           usados após um período de tempo, liberando espaço e overhead
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FUNÇÃO: Identificar Índices Não Utilizados
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_unused_indexes(
    min_age_days INTEGER DEFAULT 90  -- Índices devem ter pelo menos 90 dias sem uso
)
RETURNS TABLE (
    schema_name TEXT,
    table_name TEXT,
    index_name TEXT,
    index_size TEXT,
    never_used BOOLEAN,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname::TEXT,
        s.relname::TEXT,
        s.indexrelname::TEXT,
        pg_size_pretty(pg_relation_size(i.indexrelid))::TEXT as index_size,
        (s.idx_scan = 0)::BOOLEAN as never_used,
        CASE 
            WHEN s.idx_scan = 0 THEN 'Nunca foi usado desde a criação'
            ELSE 'Usado ' || s.idx_scan || ' vezes'
        END::TEXT as reason
    FROM 
        pg_stat_user_indexes s
        JOIN pg_index i ON s.indexrelid = i.indexrelid
    WHERE 
        s.schemaname = 'public'
        AND s.idx_scan = 0  -- Nunca foi usado
        AND NOT i.indisprimary  -- NÃO é chave primária
        AND NOT i.indisunique   -- NÃO é constraint UNIQUE
        -- Excluir índices de chaves estrangeiras (eles têm sufixo _fkey)
        AND s.indexrelname NOT LIKE '%_pkey'
        AND s.indexrelname NOT LIKE '%_key'
        -- Excluir índices usados pelo Supabase internamente
        AND s.indexrelname NOT LIKE 'supabase_%'
    ORDER BY 
        pg_relation_size(i.indexrelid) DESC;  -- Maiores primeiro
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. FUNÇÃO: Remover Índices Não Utilizados (COM SEGURANÇA)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_unused_indexes(
    dry_run BOOLEAN DEFAULT TRUE,  -- Por padrão, apenas simula (não deleta)
    min_age_days INTEGER DEFAULT 90
)
RETURNS TABLE (
    action TEXT,
    schema_name TEXT,
    table_name TEXT,
    index_name TEXT,
    size_freed TEXT,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rec RECORD;
    sql_command TEXT;
BEGIN
    FOR rec IN 
        SELECT * FROM public.get_unused_indexes(min_age_days)
    LOOP
        -- Construir comando DROP
        sql_command := format('DROP INDEX IF EXISTS %I.%I', 
                             rec.schema_name, 
                             rec.index_name);
        
        IF dry_run THEN
            -- Modo simulação: apenas reporta o que SERIA deletado
            RETURN QUERY SELECT 
                'SIMULATED'::TEXT,
                rec.schema_name,
                rec.table_name,
                rec.index_name,
                rec.index_size,
                'Seria removido (dry_run=true)'::TEXT;
        ELSE
            -- Modo real: deleta o índice
            BEGIN
                EXECUTE sql_command;
                RETURN QUERY SELECT 
                    'DELETED'::TEXT,
                    rec.schema_name,
                    rec.table_name,
                    rec.index_name,
                    rec.index_size,
                    'Removido com sucesso'::TEXT;
            EXCEPTION WHEN OTHERS THEN
                RETURN QUERY SELECT 
                    'FAILED'::TEXT,
                    rec.schema_name,
                    rec.table_name,
                    rec.index_name,
                    rec.index_size,
                    format('Erro: %s', SQLERRM)::TEXT;
            END;
        END IF;
    END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. FUNÇÃO: Relatório de Saúde de Índices
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.index_health_report()
RETURNS TABLE (
    metric TEXT,
    value TEXT,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_indexes INTEGER;
    unused_indexes INTEGER;
    total_size BIGINT;
    unused_size BIGINT;
BEGIN
    -- Contar índices totais
    SELECT COUNT(*), COALESCE(SUM(pg_relation_size(indexrelid)), 0)
    INTO total_indexes, total_size
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public';
    
    -- Contar índices não utilizados
    SELECT COUNT(*), COALESCE(SUM(pg_relation_size(s.indexrelid)), 0)
    INTO unused_indexes, unused_size
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON s.indexrelid = i.indexrelid
    WHERE s.schemaname = 'public'
      AND s.idx_scan = 0
      AND NOT i.indisprimary
      AND NOT i.indisunique;
    
    -- Métricas
    RETURN QUERY SELECT 'Total de índices'::TEXT, 
                        total_indexes::TEXT, 
                        '📊'::TEXT;
    
    RETURN QUERY SELECT 'Índices não utilizados'::TEXT, 
                        unused_indexes::TEXT,
                        CASE WHEN unused_indexes = 0 THEN '✅' ELSE '⚠️' END;
    
    RETURN QUERY SELECT 'Espaço total em índices'::TEXT, 
                        pg_size_pretty(total_size),
                        '💾'::TEXT;
    
    RETURN QUERY SELECT 'Espaço em índices não utilizados'::TEXT, 
                        pg_size_pretty(unused_size),
                        CASE WHEN unused_size = 0 THEN '✅' 
                             WHEN unused_size < 1048576 THEN '🟡' -- < 1MB
                             ELSE '⚠️' END;
    
    RETURN QUERY SELECT 'Potencial de economia'::TEXT,
                        ROUND((unused_size::NUMERIC / NULLIF(total_size, 0) * 100), 2)::TEXT || '%',
                        '📈'::TEXT;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. COMENTÁRIOS E DOCUMENTAÇÃO
-- ----------------------------------------------------------------------------
COMMENT ON FUNCTION public.get_unused_indexes IS 
'Lista todos os índices que nunca foram usados, excluindo PKs, UNIQUEs e FKs.
Uso: SELECT * FROM get_unused_indexes(); -- padrão 90 dias
      SELECT * FROM get_unused_indexes(180); -- 180 dias';

COMMENT ON FUNCTION public.cleanup_unused_indexes IS 
'Remove índices não utilizados. Por padrão roda em modo simulação (dry_run=true).
Uso: SELECT * FROM cleanup_unused_indexes(); -- Simular
      SELECT * FROM cleanup_unused_indexes(false); -- DELETAR REALMENTE';

COMMENT ON FUNCTION public.index_health_report IS 
'Gera um relatório de saúde dos índices do banco.
Uso: SELECT * FROM index_health_report();';

-- ----------------------------------------------------------------------------
-- 5. PERMISSÕES (apenas supabase_admin pode executar)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_unused_indexes FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_unused_indexes FROM PUBLIC;
REVOKE ALL ON FUNCTION public.index_health_report FROM PUBLIC;

-- Apenas admins podem executar
GRANT EXECUTE ON FUNCTION public.get_unused_indexes TO supabase_admin;
GRANT EXECUTE ON FUNCTION public.cleanup_unused_indexes TO supabase_admin;
GRANT EXECUTE ON FUNCTION public.index_health_report TO supabase_admin;

-- ============================================================================
-- INSTRUÇÕES DE USO
-- ============================================================================
-- 
-- 1. VERIFICAR ÍNDICES NÃO UTILIZADOS:
--    SELECT * FROM public.get_unused_indexes();
--
-- 2. SIMULAR LIMPEZA (sem deletar):
--    SELECT * FROM public.cleanup_unused_indexes();
--
-- 3. LIMPEZA REAL (CUIDADO!):
--    SELECT * FROM public.cleanup_unused_indexes(dry_run := false);
--
-- 4. RELATÓRIO DE SAÚDE:
--    SELECT * FROM public.index_health_report();
--
-- 5. AGENDAR LIMPEZA AUTOMÁTICA (veja documentação abaixo)
--
-- ============================================================================
