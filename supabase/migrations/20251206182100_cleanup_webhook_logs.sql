-- Função para limpar logs antigos de webhook
CREATE OR REPLACE FUNCTION cleanup_webhook_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM webhook_logs
  WHERE created_at < NOW() - INTERVAL '15 days';
END;
$$ LANGUAGE plpgsql;

-- Agendar a limpeza para rodar todos os dias à meia-noite (UTC)
SELECT cron.schedule(
  'cleanup-webhook-logs-daily', -- nome do job
  '0 0 * * *',                    -- cron schedule (meia-noite todo dia)
  $$SELECT cleanup_webhook_logs()$$
);
