-- Renomear função antiga para evitar uso por clientes desatualizados
-- Isso fará com que qualquer chamada para 'get_events_for_user' falhe imediatamente.

ALTER FUNCTION get_events_for_user() RENAME TO get_events_for_user_deprecated;
