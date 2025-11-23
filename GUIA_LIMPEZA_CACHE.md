# 🧹 Guia de Limpeza Completa - Volunteer Dashboard

## ✅ Mudanças Implementadas

### 1. Service Worker Atualizado
- ✅ Versão do cache atualizada para `v10` em ambos os arquivos (`sw.js` e `public/sw.js`)
- ✅ Isso forçará a limpeza de todos os caches antigos automaticamente

### 2. Subscrições Realtime Otimizadas
- ✅ Adicionados logs de debug para monitorar conexões
- ✅ Configuração `broadcast: { self: false }` para evitar mensagens duplicadas
- ✅ Otimizadas as dependências dos `useEffect` para evitar reconexões desnecessárias
- ✅ Callbacks de status adicionados para monitorar o estado das conexões

### 3. React Query Implementado
- ✅ `useAdminUsers` - Cache de 5 minutos para lista de usuários
- ✅ `useLeaders` - Compartilha cache com `useAdminUsers`
- ✅ `useVolunteerDashboardData` - Centraliza todos os dados do dashboard
- ✅ `useTodaysEvents` - Cache de eventos de hoje

---

## 🔧 Passos para Limpeza Manual

### **Passo 1: Limpar Cache do Navegador**

#### **Chrome/Edge/Brave:**
1. Abra o DevTools: `F12` ou `Cmd+Option+I` (Mac)
2. Vá para a aba **Application**
3. No menu lateral, clique em **Storage**
4. Clique em **Clear site data**
5. Marque todas as opções:
   - ✅ Unregister service workers
   - ✅ Local and session storage
   - ✅ IndexedDB
   - ✅ Web SQL
   - ✅ Cookies
   - ✅ Cache storage
6. Clique em **Clear site data**

#### **Firefox:**
1. Abra o DevTools: `F12`
2. Vá para a aba **Storage**
3. Clique com botão direito em cada item e selecione **Delete All**
4. Ou use `Cmd+Shift+Delete` e limpe "Tudo"

#### **Safari:**
1. Menu **Safari** > **Preferências** > **Avançado**
2. Marque "Mostrar menu Desenvolver"
3. Menu **Desenvolver** > **Limpar Caches**
4. Menu **Safari** > **Limpar Histórico**

---

### **Passo 2: Forçar Hard Reload**

Depois de limpar o cache:

- **Chrome/Edge:** `Ctrl+Shift+R` (Windows) ou `Cmd+Shift+R` (Mac)
- **Firefox:** `Ctrl+Shift+R` (Windows) ou `Cmd+Shift+R` (Mac)
- **Safari:** `Cmd+Option+R`

Ou:
1. Abra DevTools (`F12`)
2. Clique com botão direito no botão de reload
3. Selecione **"Empty Cache and Hard Reload"**

---

### **Passo 3: Verificar Service Worker**

1. Abra DevTools > **Application** > **Service Workers**
2. Você deve ver: `volunteer-dashboard-v10`
3. Se ver versões antigas (v6, v7, v8, v9), clique em **Unregister** nelas
4. Recarregue a página

---

### **Passo 4: Monitorar Logs do Realtime**

Após recarregar, abra o Console do DevTools e procure por:

```
[Realtime] Subscribing to notifications for user: <user_id>
[Realtime] Notifications channel status: SUBSCRIBED
```

Se você ver muitas reconexões (status mudando de SUBSCRIBED para CLOSED repetidamente), isso indica um problema de rede ou configuração.

---

## 🔍 Verificação de Sucesso

### **1. Verificar se `get_events_for_user` desapareceu**

Abra DevTools > **Network** e filtre por:
- `get_events_for_user`

Navegue pela aplicação. Se essa RPC não aparecer mais, o cache foi limpo com sucesso! ✅

### **2. Verificar Chamadas ao API Gateway**

No **Network**, filtre por:
- `supabase.co` ou seu domínio Supabase

Você deve ver:
- ✅ **Menos chamadas repetitivas** para `/rest/v1/events`
- ✅ **Menos chamadas** para `/auth/v1/admin/users`
- ✅ **Chamadas Realtime** devem ser estáveis (não reconectando constantemente)

### **3. Verificar Cache do React Query**

No Console, digite:
```javascript
window.__REACT_QUERY_DEVTOOLS__?.queryClient.getQueryCache().getAll()
```

Você deve ver queries com `staleTime` de 5 minutos.

---

## 📊 Impacto Esperado

| Métrica | Antes | Depois (Esperado) |
|---------|-------|-------------------|
| Chamadas Realtime | 46,107 | ~5,000 (redução de 89%) |
| `get_events_for_user` | 1,104 | 0 (eliminado) |
| Chamadas de eventos | 552 | ~100 (redução de 82%) |
| Cache hit rate | Variável | 95%+ |

---

## 🚨 Troubleshooting

### **Problema: Service Worker não atualiza**
**Solução:**
1. DevTools > Application > Service Workers
2. Marque "Update on reload"
3. Clique em "Unregister" em todos os SWs
4. Recarregue a página

### **Problema: Realtime reconectando constantemente**
**Solução:**
1. Verifique os logs no Console
2. Se ver muitos `CLOSED` → `SUBSCRIBED`, pode ser problema de rede
3. Considere aumentar o `staleTime` das queries para reduzir refetches

### **Problema: `get_events_for_user` ainda aparece**
**Solução:**
1. Verifique se há outra aba/janela aberta com a aplicação antiga
2. Feche TODAS as abas do site
3. Limpe o cache novamente
4. Abra em aba anônima para testar

---

## 📈 Próximos Passos

Após a limpeza:

1. **Monitore por 24h** as métricas do API Gateway
2. **Verifique os logs** do Realtime no Console
3. **Teste a aplicação** em diferentes cenários:
   - Login/Logout
   - Navegação entre páginas
   - Múltiplas abas abertas
4. **Reporte os resultados** - Compare com os dados anteriores

---

## 🎯 Checklist Final

- [ ] Cache do navegador limpo
- [ ] Hard reload executado
- [ ] Service Worker v10 ativo
- [ ] Logs do Realtime aparecendo no Console
- [ ] `get_events_for_user` não aparece mais no Network
- [ ] Aplicação funcionando normalmente
- [ ] Monitoramento do API Gateway configurado

---

**Data de Criação:** 2025-11-23  
**Versão do Service Worker:** v10  
**Versão do React Query:** Implementado com cache de 5 minutos
