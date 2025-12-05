-- Tabela para armazenar mensagens pendentes de WhatsApp
CREATE TABLE pending_messages (
    id BIGSERIAL PRIMARY KEY,
    
    -- Dados do voluntário
    volunteer_id BIGINT REFERENCES volunteers(id),
    volunteer_name TEXT NOT NULL,
    volunteer_phone TEXT,
    user_id UUID,
    
    -- Dados do evento
    event_id BIGINT REFERENCES events(id),
    event_name TEXT NOT NULL,
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    
    -- Tipo de mensagem
    message_type TEXT NOT NULL, -- 'new_schedule', '24h_before', '2h_before'
    
    -- Conteúdo da mensagem (já processado com variáveis substituídas)
    message_content TEXT NOT NULL,
    
    -- Status e controle
    status TEXT DEFAULT 'pending', -- 'pending', 'sending', 'sent', 'failed'
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
    CONSTRAINT valid_message_type CHECK (message_type IN ('new_schedule', '24h_before', '2h_before'))
);

-- Índices para performance
CREATE INDEX idx_pending_messages_status ON pending_messages(status) WHERE status = 'pending';
CREATE INDEX idx_pending_messages_created_at ON pending_messages(created_at);
CREATE INDEX idx_pending_messages_event_id ON pending_messages(event_id);
CREATE INDEX idx_pending_messages_retry ON pending_messages(retry_count) WHERE status = 'pending';

-- Comentários
COMMENT ON TABLE pending_messages IS 'Fila de mensagens WhatsApp pendentes para processamento em lote';
COMMENT ON COLUMN pending_messages.message_type IS 'Tipo de notificação: new_schedule (escalação), 24h_before (lembrete 24h), 2h_before (lembrete 2h)';
COMMENT ON COLUMN pending_messages.status IS 'Status: pending (aguardando), sending (processando), sent (enviado), failed (falhou após 3 tentativas)';
