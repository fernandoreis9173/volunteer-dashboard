-- ============================================================================
-- CORREÇÃO DE SEGURANÇA: Definir search_path nas funções
-- ============================================================================
-- Problema: Functions sem search_path explícito são vulneráveis
-- Solução: Adicionar SET search_path nas funções SECURITY DEFINER
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CORRIGIR: get_unused_indexes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_unused_indexes(
    min_age_days INTEGER DEFAULT 90
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
SET search_path = public, pg_catalog, pg_temp  -- FIX: search_path explícito
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
        AND s.idx_scan = 0
        AND NOT i.indisprimary
        AND NOT i.indisunique
        AND s.indexrelname NOT LIKE '%_pkey'
        AND s.indexrelname NOT LIKE '%_key'
        AND s.indexrelname NOT LIKE 'supabase_%'
    ORDER BY 
        pg_relation_size(i.indexrelid) DESC;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. CORRIGIR: cleanup_unused_indexes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_unused_indexes(
    dry_run BOOLEAN DEFAULT TRUE,
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
SET search_path = public, pg_catalog, pg_temp  -- FIX: search_path explícito
AS $$
DECLARE
    rec RECORD;
    sql_command TEXT;
BEGIN
    FOR rec IN 
        SELECT * FROM public.get_unused_indexes(min_age_days)
    LOOP
        sql_command := format('DROP INDEX IF EXISTS %I.%I', 
                             rec.schema_name, 
                             rec.index_name);
        
        IF dry_run THEN
            RETURN QUERY SELECT 
                'SIMULATED'::TEXT,
                rec.schema_name,
                rec.table_name,
                rec.index_name,
                rec.index_size,
                'Seria removido (dry_run=true)'::TEXT;
        ELSE
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
-- 3. CORRIGIR: index_health_report
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.index_health_report()
RETURNS TABLE (
    metric TEXT,
    value TEXT,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp  -- FIX: search_path explícito
AS $$
DECLARE
    total_indexes INTEGER;
    unused_indexes INTEGER;
    total_size BIGINT;
    unused_size BIGINT;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(pg_relation_size(indexrelid)), 0)
    INTO total_indexes, total_size
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public';
    
    SELECT COUNT(*), COALESCE(SUM(pg_relation_size(s.indexrelid)), 0)
    INTO unused_indexes, unused_size
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON s.indexrelid = i.indexrelid
    WHERE s.schemaname = 'public'
      AND s.idx_scan = 0
      AND NOT i.indisprimary
      AND NOT i.indisunique;
    
    RETURN QUERY SELECT 'Total de índices'::TEXT, 
                        total_indexes::TEXT, 
                        'info'::TEXT;
    
    RETURN QUERY SELECT 'Índices não utilizados'::TEXT, 
                        unused_indexes::TEXT,
                        CASE WHEN unused_indexes = 0 THEN 'ok' ELSE 'warning' END;
    
    RETURN QUERY SELECT 'Espaço total em índices'::TEXT, 
                        pg_size_pretty(total_size),
                        'info'::TEXT;
    
    RETURN QUERY SELECT 'Espaço em índices não utilizados'::TEXT, 
                        pg_size_pretty(unused_size),
                        CASE WHEN unused_size = 0 THEN 'ok' 
                             WHEN unused_size < 1048576 THEN 'info'
                             ELSE 'warning' END;
    
    RETURN QUERY SELECT 'Potencial de economia'::TEXT,
                        ROUND((unused_size::NUMERIC / NULLIF(total_size, 0) * 100), 2)::TEXT || '%',
                        'info'::TEXT;
END;
$$;

-- ============================================================================
-- FIM DA CORREÇÃO
-- ============================================================================
