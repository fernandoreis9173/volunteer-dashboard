-- Tabela para gerenciar sessões de atendimento
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    volunteer_id UUID REFERENCES auth.users(id) NOT NULL,
    leader_id UUID REFERENCES auth.users(id) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- Garantir que um voluntário só tenha uma sessão ativa por vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_sessions ON chat_sessions (volunteer_id) WHERE status = 'active';

-- Habilitar RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (Corrigido para usar 'profiles' em vez de 'users')
CREATE POLICY "Leaders and Admins can view all sessions" ON chat_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'leader' OR role = 'Líder')
        )
    );

CREATE POLICY "Leaders and Admins can insert sessions" ON chat_sessions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'leader' OR role = 'Líder')
        )
    );

CREATE POLICY "Leaders and Admins can update sessions" ON chat_sessions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'leader' OR role = 'Líder')
        )
    );
