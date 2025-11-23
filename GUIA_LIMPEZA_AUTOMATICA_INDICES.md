# 🤖 Sistema Automático de Limpeza de Índices Não Utilizados

## 📋 O Que Este Sistema Faz?

Este sistema automatizado:
1. ✅ Identifica índices que **nunca foram usados** no banco de dados
2. ✅ Protege índices críticos (PKs, UNIQUEs, FKs) contra remoção acidental
3. ✅ Gera relatórios de saúde dos índices
4. ✅ Remove automaticamente índices não utilizados (com modo dry-run)
5. ✅ Pode ser agendado para rodar mensalmente via cron

---

## 🚀 Instalação (Passo a Passo)

### 1️⃣ Aplicar as Funções SQL no Banco

Execute o arquivo `auto_cleanup_unused_indexes.sql` no seu banco Supabase:

```bash
# Via MCP (recomendado)
# O arquivo já foi criado, basta aplicar a migração
```

Ou copie e cole o conteúdo do arquivo no **SQL Editor** do Supabase Dashboard.

---

### 2️⃣ Deploy da Edge Function (Opcional - para automação via cron)

```bash
# Fazer deploy da função
npx supabase functions deploy cleanup-indexes

# Configurar variáveis de ambiente (no dashboard do Supabase)
# Vá em: Edge Functions > cleanup-indexes > Settings > Secrets
```

**Variáveis necessárias:**
- `CLEANUP_SECRET`: Um token secreto qualquer (ex: `meu-token-super-secreto-123`)
- `CLEANUP_DRY_RUN`: `true` (inicialmente) ou `false` (para deletar realmente)

---

### 3️⃣ Configurar Agendamento (Cron)

**Opção A: Via Supabase Dashboard** (Recomendado)
1. Ir em **Edge Functions** > `cleanup-indexes`
2. Clicar em **Configure**
3. Adicionar **Cron schedule**: `0 0 1 * *` (todo dia 1 do mês às 00:00 UTC)

**Opção B: Via GitHub Actions** (Alternativa)
Adicione no `.github/workflows/cleanup-indexes.yml`:

```yaml
name: Cleanup Unused Indexes

on:
  schedule:
    - cron: '0 0 1 * *'  # Todo dia 1 do mês às 00:00 UTC
  workflow_dispatch:  # Permite execução manual

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Call Cleanup Function
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CLEANUP_SECRET }}" \
            https://seu-projeto.supabase.co/functions/v1/cleanup-indexes
```

---

## 🧪 Testando o Sistema (Antes de Automatizar)

### Teste 1: Verificar Índices Não Utilizados

Execute no **SQL Editor** doSupabase:

```sql
-- Ver quais índices nunca foram usados
SELECT * FROM public.get_unused_indexes();
```

**Resultado esperado**: Lista de índices com `idx_scan = 0`

---

### Teste 2: Relatório de Saúde

```sql
-- Ver relatório geral dos índices
SELECT * FROM public.index_health_report();
```

**Resultado esperado**:
| metric | value | status |
|--------|-------|--------|
| Total de índices | 45 | 📊 |
| Índices não utilizados | 8 | ⚠️ |
| Espaço total em índices | 2.5 MB | 💾 |
| Espaço em índices não utilizados | 128 kB | 🟡 |
| Potencial de economia | 5.12% | 📈 |

---

### Teste 3: Simulação de Limpeza (Dry Run)

```sql
-- Simular remoção (NÃO deleta nada)
SELECT * FROM public.cleanup_unused_indexes();
-- ou
SELECT * FROM public.cleanup_unused_indexes(dry_run := true);
```

**Resultado esperado**:
| action | index_name | status |
|--------|-----------|--------|
| SIMULATED | idx_old_unused | Seria removido (dry_run=true) |

---

### Teste 4: Limpeza REAL (CUIDADO!)

⚠️ **APENAS após validar os resultados da simulação!**

```sql
-- Deletar índices não utilizados REALMENTE
SELECT * FROM public.cleanup_unused_indexes(dry_run := false);
```

---

## 📅 Fluxo de Uso Recomendado

### Semana 1-4: Modo Observação
- ✅ Rodar `index_health_report()` semanalmente
- ✅ Rodar `get_unused_indexes()` para conhecer os índices
- ✅ Validar que nenhum índice crítico está na lista

### Mês 2: Primeira Limpeza Manual
- ✅ Rodar `cleanup_unused_indexes(dry_run := true)` (simulação)
- ✅ Validar os resultados
- ✅ Se OK, rodar `cleanup_unused_indexes(dry_run := false)` (real)

### Mês 3+: Automação
- ✅ Configurar cron mensal da Edge Function
- ✅ Setar `CLEANUP_DRY_RUN=false` nas variáveis de ambiente
- ✅ Monitorar logs mensalmente

---

## 🛡️ Proteções Implementadas

O sistema **NÃO** remove:
- ❌ Chaves primárias (`_pkey`)
- ❌ Constraints UNIQUE (`_key`)
- ❌ Índices de chaves estrangeiras (detectados automaticamente)
- ❌ Índices do sistema Supabase (`supabase_%`)

O sistema **SÓ** remove:
- ✅ Índices personalizados que **nunca** foram usados (`idx_scan = 0`)
- ✅ Índices com mais de 90 dias sem uso (configurável)

---

## 🔔 Notificações (Opcional)

Para receber notificações quando índices forem removidos, adicione no `index.ts` da Edge Function:

```typescript
// Exemplo: Enviar email via Resend
if (!dryRun && response.summary.indexes_deleted > 0) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'noreply@seu-dominio.com',
      to: 'admin@seu-dominio.com',
      subject: `[Banco] ${response.summary.indexes_deleted} índices foram removidos`,
      html: `<pre>${JSON.stringify(response, null, 2)}</pre>`
    })
  });
}
```

---

## 📊 Monitoramento

### Ver Logs da Edge Function

```bash
npx supabase functions logs cleanup-indexes
```

### Ver Histórico de Execuções

No SQL Editor:

```sql
-- Criar tabela de auditoria (opcional)
CREATE TABLE IF NOT EXISTS public.index_cleanup_log (
  id BIGSERIAL PRIMARY KEY,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  dry_run BOOLEAN,
  indexes_removed INTEGER,
  space_freed TEXT,
  details JSONB
);

-- Modificar a Edge Function para logar execuções nesta tabela
```

---

## ❓ FAQ

### 1. É seguro rodar isso em produção?
**SIM**, se você:
- ✅ Testar primeiro com `dry_run=true`
- ✅ Validar a lista de índices antes de deletar
- ✅ Fazer backup do banco antes da primeira execução real

### 2. E se eu deletar um índice importante?
- Os índices críticos (PKs, UNIQUEs, FKs) são protegidos
- Você sempre pode recriar um índice facilmente
- A função **força** dry_run=true por padrão

### 3. Com que frequência devo rodar?
- **Recomendado**: 1x por mês
- **Mínimo**: 1x por trimestre
- **Máximo**: 1x por semana (se você cria muitos índices de teste)

### 4. Quanto espaço vou economizar?
- Depende do seu uso
- Geralmente: 5-15% do espaço total em índices
- Para ver o potencial: `SELECT * FROM index_health_report();`

---

## 🚨 Troubleshooting

### Erro: "permission denied for function cleanup_unused_indexes"
**Solução**: Execute com usuário `supabase_admin` ou adicione permissão:
```sql
GRANT EXECUTE ON FUNCTION public.cleanup_unused_indexes TO authenticated;
```

### Erro: "function does not exist"
**Solução**: Execute primeiro o arquivo `auto_cleanup_unused_indexes.sql`

### Edge Function retorna 401 Unauthorized
**Solução**: Verifique se o header `Authorization: Bearer SEU_SECRET` está correto

---

## 📝 Checklist de Configuração

- [ ] Aplicar `auto_cleanup_unused_indexes.sql` no banco
- [ ] Testar `get_unused_indexes()`
- [ ] Testar `index_health_report()`
- [ ] Testar `cleanup_unused_indexes()` com dry_run=true
- [ ] (Opcional) Deploy da Edge Function `cleanup-indexes`
- [ ] (Opcional) Configurar variáveis de ambiente
- [ ] (Opcional) Configurar cron schedule
- [ ] Validar primeira execução real (dry_run=false)
- [ ] Agendar execuções mensais

---

## 🎯 Conclusão

Agora você tem um sistema **completamente automático** para manter seu banco limpo e otimizado, sem precisar fazer nada manualmente! 🚀

**Próximos passos:**
1. Aplicar a migração SQL
2. Testar as funções manualmente
3. Configurar a automação via cron (opcional)
4. Monitorar mensalmente

---

**Dúvidas?** Execute `SELECT * FROM index_health_report();` para ver o estado atual! ✨
