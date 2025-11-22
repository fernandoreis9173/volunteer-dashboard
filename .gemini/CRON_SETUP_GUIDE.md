# 🕐 Configuração de Limpeza Automática de Notificações

## ⚠️ Limitação do Plano Free

O **pg_cron** (agendamento nativo no PostgreSQL) **não está disponível no plano Free** do Supabase. Ele só está disponível no **plano Pro ($25/mês)**.

Mas existem **alternativas gratuitas** para agendar a limpeza automática!

---

## 🎯 Opção 1: cron-job.org (Recomendado - 100% Gratuito)

### Passo a Passo:

1. **Acesse:** https://cron-job.org/en/
2. **Crie uma conta gratuita**
3. **Crie um novo Cron Job:**
   - **Title:** `Cleanup Notifications - Volunteer Dashboard`
   - **URL:** `https://zmgwuttcqmpyonvtjprw.supabase.co/functions/v1/cleanup-notifications`
   - **Schedule:** 
     - Frequência: `Monthly` (Mensal)
     - Dia: `1` (Todo dia 1 do mês)
     - Hora: `03:00` (3h da manhã)
   - **Request Method:** `POST`
   - **Headers:**
     ```
     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     ```
     *(Substitua pelo seu ANON_KEY do Supabase)*

4. **Salvar e Ativar**

### Vantagens:
- ✅ 100% Gratuito
- ✅ Interface simples
- ✅ Notificações por email se falhar
- ✅ Histórico de execuções
- ✅ Até 3 jobs gratuitos

---

## 🎯 Opção 2: GitHub Actions (Gratuito se tiver repositório)

### Criar arquivo: `.github/workflows/cleanup-notifications.yml`

```yaml
name: Database Cleanup - Notifications

on:
  schedule:
    # Executa todo dia 1 de cada mês às 3h UTC
    - cron: '0 3 1 * *'
  workflow_dispatch: # Permite executar manualmente

jobs:
  cleanup:
    runs-on: ubuntu-latest
    
    steps:
      - name: Call Supabase Cleanup Function
        run: |
          response=$(curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            -w "\n%{http_code}" \
            https://zmgwuttcqmpyonvtjprw.supabase.co/functions/v1/cleanup-notifications)
          
          http_code=$(echo "$response" | tail -n1)
          body=$(echo "$response" | head -n-1)
          
          echo "HTTP Status: $http_code"
          echo "Response: $body"
          
          if [ $http_code -ne 200 ]; then
            echo "Error: Cleanup failed!"
            exit 1
          fi
          
      - name: Notify on failure
        if: failure()
        run: echo "::error::Database cleanup failed! Check the logs."
```

### Configurar Secret no GitHub:

1. Vá em: `Settings` → `Secrets and variables` → `Actions`
2. Clique em `New repository secret`
3. Nome: `SUPABASE_ANON_KEY`
4. Valor: Sua chave anon do Supabase

### Vantagens:
- ✅ Gratuito (2000 minutos/mês)
- ✅ Integrado ao repositório
- ✅ Pode executar manualmente
- ✅ Logs detalhados

---

## 🎯 Opção 3: Easycron (Gratuito com limitações)

### Passo a Passo:

1. **Acesse:** https://www.easycron.com/
2. **Crie uma conta gratuita** (até 1 cron job grátis)
3. **Criar Cron Job:**
   - **URL:** `https://zmgwuttcqmpyonvtjprw.supabase.co/functions/v1/cleanup-notifications`
   - **Cron Expression:** `0 3 1 * *` (Todo dia 1 às 3h)
   - **HTTP Method:** `POST`
   - **HTTP Headers:**
     ```
     Authorization: Bearer SUA_ANON_KEY
     ```

### Vantagens:
- ✅ Interface amigável
- ✅ Notificações por email
- ⚠️ Limitado a 1 job no plano free

---

## 🎯 Opção 4: Upgrade para Supabase Pro (Pago)

Se você quiser usar **pg_cron nativo**, precisa fazer upgrade para o plano Pro.

### Configuração com pg_cron (Plano Pro):

```sql
-- Habilitar extensão pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar limpeza mensal (todo dia 1 às 3h)
SELECT cron.schedule(
    'cleanup-old-notifications',           -- Nome do job
    '0 3 1 * *',                           -- Cron expression (dia 1, 3h)
    $$SELECT cleanup_old_notifications()$$ -- SQL a executar
);

-- Verificar jobs agendados
SELECT * FROM cron.job;

-- Ver histórico de execuções
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

### Vantagens:
- ✅ Nativo no banco
- ✅ Zero latência
- ✅ Mais confiável
- ✅ Suporte prioritário
- ❌ Custa $25/mês

---

## 📊 Comparação das Opções

| Opção | Custo | Facilidade | Confiabilidade | Recomendado? |
|-------|-------|------------|----------------|--------------|
| **cron-job.org** | Grátis | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ **SIM** |
| **GitHub Actions** | Grátis | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **SIM** |
| **Easycron** | Grátis | ⭐⭐⭐⭐ | ⭐⭐⭐ | 🟡 OK |
| **pg_cron (Pro)** | $25/mês | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 🟡 Se tiver budget |

---

## 🔑 Como Obter sua ANON_KEY

1. Acesse: https://supabase.com/dashboard/project/zmgwuttcqmpyonvtjprw/settings/api
2. Copie a chave em **Project API keys** → **anon** → **public**
3. Use essa chave no header `Authorization: Bearer SUA_CHAVE`

---

## ✅ Recomendação Final

Para o seu caso (plano Free), recomendo usar **cron-job.org** ou **GitHub Actions**:

### Use **cron-job.org** se:
- ✅ Quer configurar em 5 minutos
- ✅ Não quer mexer no código
- ✅ Quer interface visual

### Use **GitHub Actions** se:
- ✅ Já tem o código no GitHub
- ✅ Quer controle via código
- ✅ Quer logs detalhados

---

## 🧪 Testar Manualmente

Antes de configurar o cron, teste se a função está funcionando:

```bash
curl -X POST \
  -H "Authorization: Bearer SUA_ANON_KEY" \
  -H "Content-Type: application/json" \
  https://zmgwuttcqmpyonvtjprw.supabase.co/functions/v1/cleanup-notifications
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Limpeza concluída com sucesso",
  "deleted_notifications": 0,
  "timestamp": "2025-11-21T22:56:00.000Z"
}
```

---

## 📝 Próximos Passos

1. ✅ Escolher uma das opções (cron-job.org ou GitHub Actions)
2. ✅ Configurar o agendamento
3. ✅ Testar manualmente primeiro
4. ✅ Verificar execução após 1 mês

---

*Última atualização: 21/11/2025*
