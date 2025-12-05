-- CRON Job para processar mensagens WhatsApp pendentes
-- Executa a cada 10 segundos, processando 100 mensagens por vez

SELECT cron.schedule(
    'process-whatsapp-queue',
    '*/10 * * * * *', -- A cada 10 segundos
    $$
    SELECT net.http_post(
        url := 'https://zmgwuttcqmpyonvtjprw.supabase.co/functions/v1/process-messages',
        headers := jsonb_build_object(
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZ3d1dHRjcW1weW9udnRqcHJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNjY5NjQyNSwiZXhwIjoyMDQyMjcyNDI1fQ.hWLjHLBZjfBLLYMQPTVtXNvNJJsHhYJXJQQlPdGMxwI',
            'Content-Type', 'application/json'
        )
    );
    $$
);

-- Verificar se o CRON foi criado
SELECT * FROM cron.job WHERE jobname = 'process-whatsapp-queue';
