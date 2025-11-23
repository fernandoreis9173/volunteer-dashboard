-- ============================================================================
-- OTIMIZAÇÃO FINAL DE PERFORMANCE
-- ============================================================================
-- Análise realizada em: 2025-11-23
-- 
-- Problemas identificados:
-- 1. Tabela 'departments': 2.2M sequential scans (88% do total) em apenas 7 linhas
--    Causa: Consultas frequentes por 'status' sem índice
-- 2. Tabela 'cronograma_itens': RLS policy avaliando auth.role() por linha
-- 3. Índices não utilizados podem ser removidos para economizar espaço
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CORRIGIR RLS DE CRONOGRAMA_ITENS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "policy_select_cronograma_itens" ON "public"."cronograma_itens";

CREATE POLICY "policy_select_cronograma_itens"
ON "public"."cronograma_itens"
FOR SELECT
TO authenticated
USING (
  (SELECT auth.role()) = 'authenticated'::text
);

-- ----------------------------------------------------------------------------
-- 2. ADICIONAR ÍNDICE CRUCIAL EM DEPARTMENTS.STATUS
-- ----------------------------------------------------------------------------
-- Este índice resolve 88% dos sequential scans em 'departments'
-- Query pattern: WHERE status = 'Ativo'
CREATE INDEX IF NOT EXISTS idx_departments_status 
ON public.departments(status);

-- ----------------------------------------------------------------------------
-- 3. ADICIONAR ÍNDICE COMPOSTO PARA EVENT_VOLUNTEERS
-- ----------------------------------------------------------------------------
-- Otimiza queries que filtram por department_id e present
-- Query pattern comum: WHERE department_id = X AND present = true
CREATE INDEX IF NOT EXISTS idx_event_volunteers_dept_present 
ON public.event_volunteers(department_id, present) 
WHERE present = true;

-- ----------------------------------------------------------------------------
-- 4. ATUALIZAR ESTATÍSTICAS
-- ----------------------------------------------------------------------------
-- Atualizar estatísticas para o query planner usar os novos índices
ANALYZE public.departments;
ANALYZE public.event_volunteers;
ANALYZE public.cronograma_itens;
