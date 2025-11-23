-- Otimização de RLS para volunteer_departments e cronograma_modelos
-- Problema: auth.role() sendo avaliado linha por linha.
-- Solução: Envolver em (SELECT auth.role()) para avaliar apenas uma vez por query.

-- 1. Otimizar volunteer_departments
DROP POLICY IF EXISTS "policy_select_volunteer_departments" ON "public"."volunteer_departments";

CREATE POLICY "policy_select_volunteer_departments"
ON "public"."volunteer_departments"
FOR SELECT
TO authenticated
USING (
  (SELECT auth.role()) = 'authenticated'::text
);

-- 2. Otimizar cronograma_modelos
DROP POLICY IF EXISTS "policy_select_cronograma_modelos" ON "public"."cronograma_modelos";

CREATE POLICY "policy_select_cronograma_modelos"
ON "public"."cronograma_modelos"
FOR SELECT
TO authenticated
USING (
  (SELECT auth.role()) = 'authenticated'::text
);
