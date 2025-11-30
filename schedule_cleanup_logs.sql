-- Agendamento de limpeza de logs do WhatsApp (a cada 30 dias / diariamente verifica logs > 30 dias)

-- Habilita a extensão pg_cron se não estiver habilitada
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove o job se já existir para evitar duplicatas
select cron.unschedule('cleanup-whatsapp-logs');

-- Agenda o job para rodar todos os dias às 04:00 UTC (00:00 Manaus)
-- Substitua YOUR_PROJECT_REF e YOUR_SERVICE_ROLE_KEY pelos valores reais do seu projeto
select
  cron.schedule(
    'cleanup-whatsapp-logs',
    '0 4 * * *', -- Diariamente às 04:00 UTC
    $$
    select
      net.http_post(
          url:='https://zmgwuttcqmpyonvtjprw.supabase.co/functions/v1/cleanup-whatsapp-logs',
          headers:=('{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZ3d1dHRjcW1weW9udnRqcHJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODY3ODY2MCwiZXhwIjoyMDc0MjU0NjYwfQ.SP2wdtHEw8YMF_TpOD9L-9z_PMIboXcH9hvbeutJIdI"}')::jsonb
      ) as request_id;
    $$
  );


