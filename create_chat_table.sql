-- Criar tabela de mensagens do chat
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver ON chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- RLS Policies
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver mensagens que enviaram ou receberam
CREATE POLICY "Users can view their own messages"
    ON chat_messages FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Policy: Usuários podem enviar mensagens
CREATE POLICY "Users can send messages"
    ON chat_messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- Policy: Usuários podem atualizar suas próprias mensagens (marcar como lida)
CREATE POLICY "Users can update received messages"
    ON chat_messages FOR UPDATE
    USING (auth.uid() = receiver_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_chat_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_messages_updated_at
    BEFORE UPDATE ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_messages_updated_at();
