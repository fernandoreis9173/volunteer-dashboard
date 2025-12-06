-- Update message processor cron to run every minute instead of every 10 minutes
-- The previous schedule '*/10 * * * * *' was interpreted by pg_cron as "Every 10 minutes" (minute field).
-- We change it to '* * * * *' to run every minute.

SELECT cron.unschedule('process-whatsapp-queue');

SELECT cron.schedule(
    'process-whatsapp-queue',
    '* * * * *', -- Every minute
    $$
    SELECT net.http_post(
        url := 'https://zmgwuttcqmpyonvtjprw.supabase.co/functions/v1/process-messages',
        headers := jsonb_build_object(
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZ3d1dHRjcW1weW9udnRqcHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2Nzg2NjAsImV4cCI6MjA3NDI1NDY2MH0.IVpZfKrZUTQ6x9gfkBzV9t6NxSuUbmVnOAIn8AU3CfY',
            'Content-Type', 'application/json',
            'Connection', 'keep-alive'
        ),
        body := '{}'::jsonb
    );
    $$
);
