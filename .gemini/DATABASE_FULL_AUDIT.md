# 🛡️ Auditoria Completa do Banco de Dados

**Data:** 22/11/2025
**Projeto:** VoluntariosEscalas
**Status:** ✅ SAUDÁVEL (com observações de segurança)

---

## 📊 1. Visão Geral e Capacidade

| Métrica | Valor | Status | Observação |
|---------|-------|--------|------------|
| **Tamanho Total** | 20 MB | ✅ Excelente | Apenas 4% do limite Free (500MB) |
| **Tabelas** | 14 | ✅ Normal | Estrutura enxuta |
| **Extensões** | 8 | ✅ Rico | `pg_cron`, `pg_net`, `pg_graphql` ativos |
| **Maior Tabela** | `audit_log_entries` | ℹ️ Info | 11.6k linhas (Logs de auditoria) |

### 🔝 Top 5 Tabelas por Tamanho

| Tabela | Linhas | Tamanho Total | Dados | Índices |
|--------|--------|---------------|-------|---------|
| `audit_log_entries` | 11.605 | 3.7 MB | 3.0 MB | 704 kB |
| `cron.job_run_details` | 0 | 1.5 MB | 1.5 MB | 64 kB |
| `notifications` | 1.153 | 520 kB | 352 kB | 168 kB |
| `refresh_tokens` | 511 | 336 kB | 88 kB | 248 kB |
| `users` | 13 | 208 kB | 16 kB | 192 kB |

**Análise:** O banco está muito leve. A maior parte do espaço é ocupada por logs (`audit_log_entries` e `job_run_details`), o que é saudável.

---

## ⚡ 2. Performance e Índices

### ✅ Índices Mais Utilizados
1. **`idx_notifications_user_id`**: Essencial para o sistema de notificações.
2. **`idx_events_date_status`**: Vital para filtrar eventos no calendário.
3. **`idx_event_volunteers_volunteer_id`**: Crítico para ver escalas do voluntário.

### ⚠️ Índices Não Utilizados (Candidatos a Remoção)
Estes índices ocupam espaço e não foram usados nenhuma vez. Monitorar por mais 30 dias antes de remover.
- `idx_event_departments_department_id`
- `idx_event_volunteers_department_id`
- `idx_cronograma_modelos_admin_id`
- `cronograma_itens_modelo_id_idx`

---

## 🔒 3. Segurança e RLS (Row Level Security)

### ✅ Pontos Fortes
- **RLS Ativo:** Todas as tabelas críticas (`volunteers`, `events`, `departments`) têm RLS habilitado.
- **Políticas Granulares:** Existem políticas separadas para `SELECT`, `INSERT`, `UPDATE`, `DELETE`.

### ⚠️ Pontos de Atenção (Crítico)

#### 1. Função `get_my_role()`
A função usada para verificar permissões de admin/líder nas políticas RLS é:
```sql
SELECT role FROM public.profiles WHERE id = (SELECT auth.uid());
```
**Problema Potencial:** A tabela `profiles` parece estar vazia ou não sincronizada com `auth.users`.
- Se `profiles` estiver vazia, `get_my_role()` retorna `NULL`.
- Isso bloquearia ações de Admin/Líder (como criar eventos ou editar voluntários).
- **Recomendação:** Verificar se a tabela `profiles` está sendo populada corretamente via Trigger quando um usuário é criado.

#### 2. Funções com `search_path` Mutável
Algumas funções (como `get_my_role`) não têm `search_path` definido como `security definer` seguro.
- **Risco:** Baixo, mas boa prática corrigir.
- **Ação:** Já corrigimos `cleanup_old_notifications` e `get_events_for_user`. Falta `get_my_role`.

---

## 🧩 4. Extensões Instaladas

| Extensão | Versão | Status | Descrição |
|----------|--------|--------|-----------|
| `plpgsql` | 1.0 | ✅ Core | Linguagem procedural |
| `pg_stat_statements` | 1.11 | ✅ Core | Monitoramento de queries |
| `uuid-ossp` | 1.1 | ✅ Core | Geração de UUIDs |
| `pgcrypto` | 1.3 | ✅ Core | Criptografia |
| `supabase_vault` | 0.3.1 | ✅ Supabase | Gerenciamento de segredos |
| `pg_graphql` | 1.5.11 | ✅ Supabase | API GraphQL automática |
| `pg_cron` | 1.6.4 | ✅ Ativo | Agendamento de tarefas (Limpeza) |
| `pg_net` | 0.19.5 | ✅ Ativo | Requisições HTTP assíncronas |

---

## 🎯 Conclusão e Recomendações

O banco de dados está **extremamente saudável** e bem estruturado para a escala atual e futura.

### 📝 Plano de Ação

1. **Verificar Tabela `profiles`:**
   - Confirmar se ela deve ser usada ou se devemos migrar a lógica de roles para `auth.users.raw_user_meta_data`.
   - Se for usada, criar Trigger para sincronizar novos usuários.

2. **Monitorar Índices:**
   - Manter os índices não utilizados por enquanto (volume de dados baixo).

3. **Manutenção Mensal:**
   - O job `pg_cron` já está configurado para limpar notificações antigas. Excelente!

---

*Auditoria gerada automaticamente via MCP em 22/11/2025*
