-- Otimização de Performance do Banco de Dados

-- 1. Adicionar índices para Foreign Keys não indexadas (Melhora JOINs e filtros)

-- Tabela: cronograma_itens
CREATE INDEX IF NOT EXISTS idx_cronograma_itens_modelo_id ON public.cronograma_itens(modelo_id);

-- Tabela: cronograma_modelos
CREATE INDEX IF NOT EXISTS idx_cronograma_modelos_admin_id ON public.cronograma_modelos(admin_id);

-- Tabela: events
CREATE INDEX IF NOT EXISTS idx_events_cronograma_kids_id ON public.events(cronograma_kids_id);

-- Tabela: invitations
CREATE INDEX IF NOT EXISTS idx_invitations_volunteer_id ON public.invitations(volunteer_id);

-- Tabela: notifications
-- Esta é muito importante pois notificações são consultadas frequentemente
CREATE INDEX IF NOT EXISTS idx_notifications_related_event_id ON public.notifications(related_event_id);


-- 2. Remover índices não utilizados (Reduz overhead de escrita/INSERT/UPDATE)

-- Tabela: departments
DROP INDEX IF EXISTS public.idx_departments_status;

-- Tabela: event_volunteers
DROP INDEX IF EXISTS public.idx_event_volunteers_dept_present;
