-- Otimização de Performance RLS (Row Level Security)
-- Problema: Chamadas diretas como auth.role() ou auth.uid() podem ser reavaliadas para cada linha.
-- Solução: Envolver essas chamadas em (SELECT ...) força o Postgres a avaliar apenas uma vez por query (InitPlan).

-- 1. Otimizar tabela departments
DROP POLICY IF EXISTS "policy_select_departments" ON "public"."departments";
CREATE POLICY "policy_select_departments" ON "public"."departments"
AS PERMISSIVE FOR SELECT
TO public
USING (
  (SELECT auth.role()) = 'authenticated'
);

-- 2. Otimizar tabela department_leaders
DROP POLICY IF EXISTS "policy_select_department_leaders" ON "public"."department_leaders";
CREATE POLICY "policy_select_department_leaders" ON "public"."department_leaders"
AS PERMISSIVE FOR SELECT
TO public
USING (
  (SELECT auth.role()) = 'authenticated'
);

-- Comentário: As políticas de INSERT/UPDATE/DELETE já usam get_my_role() que parece estar otimizado,
-- mas vamos garantir que o SELECT esteja explícito se necessário no futuro.
-- Por enquanto, focamos nas políticas de SELECT que são as mais críticas para leitura de dados.
