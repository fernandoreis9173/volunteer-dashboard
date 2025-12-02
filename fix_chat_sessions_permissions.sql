-- 1. Garantir que a tabela existe
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    volunteer_id UUID REFERENCES auth.users(id) NOT NULL,
    leader_id UUID REFERENCES auth.users(id) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 2. Índice único para evitar duplicidade de sessões ativas
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_sessions ON chat_sessions (volunteer_id) WHERE status = 'active';

-- 3. Habilitar RLS (Segurança em Nível de Linha)
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- 4. LIMPEZA TOTAL DE POLÍTICAS ANTIGAS (Para evitar conflitos e erros 403)
DROP POLICY IF EXISTS "Leaders and Admins can view all sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Leaders and Admins can insert sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Leaders and Admins can update sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Authenticated users can view sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Authenticated users can insert sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Authenticated users can update sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Enable read access for all users" ON chat_sessions;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON chat_sessions;
DROP POLICY IF EXISTS "Allow all authenticated users to select" ON chat_sessions;
DROP POLICY IF EXISTS "Allow all authenticated users to insert" ON chat_sessions;
DROP POLICY IF EXISTS "Allow all authenticated users to update" ON chat_sessions;

-- 5. CRIAR NOVAS POLÍTICAS (Permitir acesso a qualquer usuário logado)
-- Leitura
CREATE POLICY "Allow all authenticated users to select" ON chat_sessions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Inserção
CREATE POLICY "Allow all authenticated users to insert" ON chat_sessions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Atualização
CREATE POLICY "Allow all authenticated users to update" ON chat_sessions
    FOR UPDATE USING (auth.role() = 'authenticated');

-- 6. Conceder permissões explícitas para o role 'authenticated' e 'service_role'
GRANT ALL ON chat_sessions TO authenticated;
GRANT ALL ON chat_sessions TO service_role;
