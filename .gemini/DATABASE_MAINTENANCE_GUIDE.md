# 🔧 Guia de Manutenção do Banco de Dados

## 🎯 Tarefas de Manutenção Recomendadas

### 1. Limpeza de Notificações Antigas (Mensal)

**Por que fazer?**
A tabela `notifications` cresce continuamente e pode ocupar muito espaço desnecessariamente.

**Como executar:**

#### Opção A: Via Edge Function (Recomendado)
```bash
# Chamar a Edge Function via curl ou Postman
curl -X POST https://zmgwuttcqmpyonvtjprw.supabase.co/functions/v1/cleanup-notifications \
  -H "Authorization: Bearer SEU_ANON_KEY"
```

#### Opção B: Via SQL (Dashboard do Supabase)
```sql
SELECT cleanup_old_notifications();
```

**Resultado esperado:**
```json
{
  "success": true,
  "message": "Limpeza concluída com sucesso",
  "deleted_notifications": 150,
  "timestamp": "2025-11-21T22:50:00.000Z"
}
```

**Frequência:** 1x por mês

---

### 2. Verificar Uso de Espaço (Semanal)

```sql
-- Ver tamanho de cada tabela
SELECT 
    schemaname,
    relname as tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS total_size,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC;
```

**Ação:** Se alguma tabela ultrapassar 50 MB, investigar.

---

### 3. Monitorar Conexões (Diário via Dashboard)

```sql
-- Ver conexões ativas
SELECT 
    COUNT(*) as total_connections,
    COUNT(*) FILTER (WHERE state = 'active') as active_connections,
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
FROM pg_stat_activity 
WHERE datname = current_database();
```

**Alerta:** Se `total_connections` > 50, considerar upgrade.

---

### 4. Verificar Performance de Índices (Mensal)

```sql
-- Ver índices mais usados
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan as times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 10;
```

**Ação:** Índices com `times_used = 0` após 3 meses podem ser removidos.

---

### 5. Limpar Linhas Mortas (Trimestral)

```sql
-- VACUUM manual (libera espaço)
VACUUM ANALYZE volunteers;
VACUUM ANALYZE departments;
VACUUM ANALYZE event_volunteers;
VACUUM ANALYZE notifications;
```

**Nota:** O PostgreSQL já faz isso automaticamente, mas forçar pode ajudar.

---

## 📊 Métricas para Monitorar

### No Dashboard do Supabase

1. **Database Size** (Armazenamento)
   - Alerta: > 400 MB (80% do limite Free)
   - Crítico: > 450 MB (90% do limite Free)

2. **Bandwidth** (Largura de Banda)
   - Alerta: > 4 GB/mês
   - Crítico: > 4.5 GB/mês

3. **Active Connections**
   - Alerta: > 40 conexões simultâneas
   - Crítico: > 50 conexões simultâneas

---

## 🚨 Alertas e Ações

### Alerta: Banco com 80% de capacidade
**Sintoma:** Database size > 400 MB

**Ações:**
1. Executar limpeza de notificações antigas
2. Verificar tabelas grandes com a query de espaço
3. Considerar arquivar dados antigos
4. Planejar upgrade para Pro

### Alerta: Muitas conexões simultâneas
**Sintoma:** > 40 conexões ativas

**Ações:**
1. Verificar se há queries lentas travando conexões
2. Implementar timeout em queries longas
3. Considerar upgrade para Pro (200 conexões)

### Alerta: Largura de banda alta
**Sintoma:** > 4 GB/mês

**Ações:**
1. Verificar se React Query está funcionando (cache)
2. Otimizar tamanho de payloads (remover campos desnecessários)
3. Implementar paginação em listagens grandes
4. Considerar upgrade para Pro

---

## 🔄 Automação Futura (Opcional)

### Agendar Limpeza Automática

Para automatizar a limpeza de notificações, você pode:

1. **Usar Cron Job Externo** (ex: cron-job.org)
   - Configurar para chamar a Edge Function semanalmente
   - URL: `https://zmgwuttcqmpyonvtjprw.supabase.co/functions/v1/cleanup-notifications`

2. **Usar GitHub Actions** (se tiver repositório)
   ```yaml
   name: Database Cleanup
   on:
     schedule:
       - cron: '0 2 * * 0' # Todo domingo às 2h
   jobs:
     cleanup:
       runs-on: ubuntu-latest
       steps:
         - name: Call cleanup function
           run: |
             curl -X POST ${{ secrets.SUPABASE_FUNCTION_URL }}/cleanup-notifications \
               -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
   ```

3. **Usar Supabase Cron** (Plano Pro)
   - Disponível apenas no plano Pro
   - Permite agendar funções SQL diretamente

---

## 📝 Checklist de Manutenção

### Semanal
- [ ] Verificar uso de espaço no dashboard
- [ ] Verificar número de conexões ativas
- [ ] Verificar largura de banda consumida

### Mensal
- [ ] Executar limpeza de notificações antigas
- [ ] Verificar performance de índices
- [ ] Revisar logs de erros

### Trimestral
- [ ] Executar VACUUM manual
- [ ] Revisar e otimizar queries lentas
- [ ] Avaliar necessidade de upgrade de plano

### Anual
- [ ] Auditoria completa de segurança (RLS)
- [ ] Revisar e arquivar dados históricos
- [ ] Planejar crescimento para próximo ano

---

## 🆘 Contatos e Recursos

- **Dashboard Supabase:** https://supabase.com/dashboard/project/zmgwuttcqmpyonvtjprw
- **Documentação:** https://supabase.com/docs
- **Suporte:** https://supabase.com/support

---

*Última atualização: 21/11/2025*
