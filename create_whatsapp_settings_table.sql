-- Tabela para armazenar configurações da API do WhatsApp (Evolution API)
create table if not exists whatsapp_settings (
  id uuid primary key default gen_random_uuid(),
  evolution_url text not null,
  token text not null,
  session_name text not null,
  active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Adicionar RLS (Row Level Security)
alter table whatsapp_settings enable row level security;

-- Política: Apenas admins podem ver e editar configurações do WhatsApp
create policy "Admins can view whatsapp settings"
  on whatsapp_settings
  for select
  using (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
      and auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

create policy "Admins can insert whatsapp settings"
  on whatsapp_settings
  for insert
  with check (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
      and auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

create policy "Admins can update whatsapp settings"
  on whatsapp_settings
  for update
  using (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
      and auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

create policy "Admins can delete whatsapp settings"
  on whatsapp_settings
  for delete
  using (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
      and auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Trigger para atualizar updated_at automaticamente
create or replace function update_whatsapp_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger whatsapp_settings_updated_at
  before update on whatsapp_settings
  for each row
  execute function update_whatsapp_settings_updated_at();
