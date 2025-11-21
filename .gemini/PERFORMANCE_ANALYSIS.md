# 🚨 Análise de Performance - API Gateway

## Problemas Identificados nos Logs

### 1. **Requisições Duplicadas/Triplicadas** ⚠️ CRÍTICO

#### Evidências:
```
POST /rest/v1/rpc/get_events_for_user - 1763742610526000
POST /rest/v1/rpc/get_events_for_user - 1763742610517000  (9ms depois)
GET  /rest/v1/events?...volunteer_id=eq.34 - 1763742610532000 (6ms depois)
```

**Causa Provável:**
- Múltiplos `useEffect` disparando simultaneamente
- Falta de debounce/throttle
- Re-renders desnecessários causando refetch

**Impacto:**
- 2-3x mais requisições que o necessário
- Sobrecarga no banco de dados
- Custos aumentados
- Performance degradada

---

### 2. **Requisições de Departamentos Repetidas** ⚠️ ALTO

#### Evidências:
```
GET /rest/v1/departments?select=id,name - 1763742599815000
GET /rest/v1/departments?select=id,name - 1763742599809000  (6ms depois)
GET /rest/v1/departments?select=id,name - 1763742599736000  (73ms depois)
GET /rest/v1/departments?select=id,name - 1763742599736000  (mesmo timestamp!)
```

**Causa Provável:**
- Cada componente fazendo sua própria requisição
- Falta de cache global
- Dados não compartilhados entre componentes

**Impacto:**
- Dados raramente mudam, mas são buscados constantemente
- Desperdício de banda e recursos

---

### 3. **Polling Excessivo de Eventos** ⚠️ MÉDIO

#### Evidências:
```
GET /rest/v1/events?...date=gte.2025-01-01 - múltiplas vezes
GET /rest/v1/events?...date=gte.2025-10-23 - múltiplas vezes
```

**Causa Provável:**
- Componentes diferentes buscando eventos
- Falta de estado compartilhado
- Possível polling sem necessidade

---

### 4. **Realtime Subscriptions Múltiplas** ⚠️ MÉDIO

#### Evidências:
```
GET /realtime/v1/websocket - 1763742585481000
GET /realtime/v1/websocket - 1763742547929000
```

**Causa Provável:**
- Múltiplas conexões WebSocket sendo abertas
- Subscriptions não sendo limpas corretamente

---

### 5. **HEAD Requests Desnecessários** ⚠️ BAIXO

#### Evidências:
```
HEAD /rest/v1/volunteers?select=*&status=eq.Ativo
HEAD /rest/v1/departments?select=*&status=eq.Ativo
HEAD /rest/v1/notifications?...is_read=eq.false
```

**Causa Provável:**
- Verificações de contagem antes de buscar dados
- Pode ser otimizado com cache

---

## 📊 Estatísticas Preocupantes

- **~80 requisições** em menos de 2 minutos
- **Múltiplas requisições idênticas** em milissegundos
- **Sem cache aparente** para dados estáticos
- **Realtime connections** não gerenciadas

---

## 🎯 Recomendações de Otimização

### PRIORIDADE ALTA - Implementar Imediatamente

#### 1. **React Query / SWR para Cache Global**
```typescript
// Exemplo com React Query
import { useQuery } from '@tanstack/react-query';

const useDepartments = () => {
  return useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    staleTime: 5 * 60 * 1000, // 5 minutos
    cacheTime: 10 * 60 * 1000, // 10 minutos
  });
};
```

**Benefícios:**
- ✅ Cache automático
- ✅ Deduplicação de requisições
- ✅ Refetch inteligente
- ✅ Redução de 70-80% nas requisições

---

#### 2. **Debounce em useEffect**
```typescript
// Antes (RUIM)
useEffect(() => {
  fetchData();
}, [dependency]);

// Depois (BOM)
useEffect(() => {
  const timer = setTimeout(() => {
    fetchData();
  }, 300);
  
  return () => clearTimeout(timer);
}, [dependency]);
```

---

#### 3. **Context API para Dados Compartilhados**
```typescript
// DepartmentsContext.tsx
const DepartmentsContext = createContext();

export const DepartmentsProvider = ({ children }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const fetchDepartments = useCallback(async () => {
    if (departments.length > 0) return; // Já tem cache
    setLoading(true);
    const data = await supabase.from('departments').select('*');
    setDepartments(data);
    setLoading(false);
  }, [departments]);
  
  return (
    <DepartmentsContext.Provider value={{ departments, loading, fetchDepartments }}>
      {children}
    </DepartmentsContext.Provider>
  );
};
```

---

#### 4. **Consolidar Realtime Subscriptions**
```typescript
// Criar um único hook para gerenciar todas as subscriptions
const useRealtimeSubscriptions = (userId) => {
  useEffect(() => {
    const channel = supabase
      .channel(`user-${userId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, handleNotification)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'events'
      }, handleEvent)
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
};
```

---

### PRIORIDADE MÉDIA

#### 5. **Lazy Loading de Componentes**
```typescript
const CalendarPage = lazy(() => import('./components/CalendarPage'));
const SchedulesPage = lazy(() => import('./components/SchedulesPage'));
```

#### 6. **Memoização Agressiva**
```typescript
const calendarEvents = useMemo(() => {
  return processEvents(allEvents);
}, [allEvents]);
```

#### 7. **Pagination para Listas Grandes**
```typescript
const { data, fetchNextPage } = useInfiniteQuery({
  queryKey: ['events'],
  queryFn: ({ pageParam = 0 }) => fetchEvents(pageParam),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

---

### PRIORIDADE BAIXA

#### 8. **Service Worker para Cache de Assets**
#### 9. **Code Splitting por Rota**
#### 10. **Compression (Gzip/Brotli)**

---

## 📈 Impacto Esperado

### Antes da Otimização:
- 80 requisições / 2 minutos = **40 req/min**
- Com 100 usuários = **4,000 req/min**
- Com 1,000 usuários = **40,000 req/min** ⚠️

### Depois da Otimização (Estimativa):
- Redução de 70-80% nas requisições
- 8-12 requisições / 2 minutos = **4-6 req/min**
- Com 100 usuários = **400-600 req/min** ✅
- Com 1,000 usuários = **4,000-6,000 req/min** ✅

---

## 🛠️ Plano de Ação Sugerido

### Fase 1 (Esta Semana)
1. ✅ Implementar React Query
2. ✅ Criar Context para Departments
3. ✅ Adicionar debounce em useEffects críticos

### Fase 2 (Próxima Semana)
4. ✅ Consolidar Realtime Subscriptions
5. ✅ Implementar Lazy Loading
6. ✅ Adicionar Memoização

### Fase 3 (Futuro)
7. ✅ Pagination
8. ✅ Service Worker
9. ✅ Code Splitting

---

## 🔍 Monitoramento Contínuo

### Métricas para Acompanhar:
- Requisições por minuto (RPM)
- Tempo de resposta médio
- Taxa de cache hit
- Número de conexões WebSocket ativas
- Uso de banda

### Ferramentas Recomendadas:
- Supabase Dashboard (API Gateway Logs)
- React DevTools Profiler
- Chrome DevTools Network Tab
- Sentry para erros

---

## ⚠️ AÇÃO IMEDIATA NECESSÁRIA

**O sistema atual NÃO está preparado para escalar.**

Com o padrão atual de requisições:
- ❌ 10 usuários simultâneos = OK
- ⚠️ 50 usuários simultâneos = Degradação
- 🔥 100+ usuários simultâneos = Sobrecarga crítica

**Recomendação:** Implementar Fase 1 IMEDIATAMENTE antes de aumentar a base de usuários.
