-- CRON de Limpeza Automática
-- Roda todo dia às 03:00 AM
-- Deleta mensagens de eventos que já passaram há mais de 1 dia

SELECT cron.schedule(
    'cleanup-old-messages',
    '0 3 * * *', -- Dia a dia às 03:00
    $$
    DELETE FROM pending_messages 
    WHERE event_date < CURRENT_DATE - INTERVAL '1 day';
    $$
);

-- Query para verificar o job
SELECT * FROM cron.job WHERE jobname = 'cleanup-old-messages';
