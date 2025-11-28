-- Execute este SQL no Editor SQL do Supabase para permitir que voluntários vejam o ranking completo

-- 1. Permitir leitura da tabela volunteers para todos os usuários autenticados
DROP POLICY IF EXISTS "Volunteers viewable by everyone" ON volunteers;
DROP POLICY IF EXISTS "Volunteers viewable by self" ON volunteers;

CREATE POLICY "Volunteers viewable by everyone" 
ON volunteers FOR SELECT 
TO authenticated 
USING (true);

-- 2. Permitir leitura da tabela event_volunteers para todos os usuários autenticados (para cálculo de pontuação)
DROP POLICY IF EXISTS "Event volunteers viewable by everyone" ON event_volunteers;
DROP POLICY IF EXISTS "Event volunteers viewable by self" ON event_volunteers;

CREATE POLICY "Event volunteers viewable by everyone" 
ON event_volunteers FOR SELECT 
TO authenticated 
USING (true);

-- 3. Permitir leitura da tabela departments (geralmente já é pública, mas por garantia)
DROP POLICY IF EXISTS "Departments viewable by everyone" ON departments;

CREATE POLICY "Departments viewable by everyone" 
ON departments FOR SELECT 
TO authenticated 
USING (true);

-- 4. Permitir leitura da tabela volunteer_departments
DROP POLICY IF EXISTS "Volunteer departments viewable by everyone" ON volunteer_departments;

CREATE POLICY "Volunteer departments viewable by everyone" 
ON volunteer_departments FOR SELECT 
TO authenticated 
USING (true);
