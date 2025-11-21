# 🚀 Guia de Migração para React Query

## ✅ O que já foi implementado

1. ✅ React Query instalado
2. ✅ QueryClient configurado com cache otimizado
3. ✅ Hooks customizados criados (`hooks/useQueries.ts`)
4. ✅ App envolvido com QueryClientProvider
5. ✅ DevTools habilitado em desenvolvimento

---

## 📋 Próximos Passos - Migração de Componentes

### Prioridade ALTA - Componentes com mais requisições

#### 1. **CalendarPage.tsx**
**Antes:**
```typescript
const [allEvents, setAllEvents] = useState<Event[]>([]);
const [allDepartments, setAllDepartments] = useState<Department[]>([]);

useEffect(() => {
    fetchAllEvents();
    fetchAllDepartments();
}, [fetchAllEvents, fetchAllDepartments]);
```

**Depois:**
```typescript
import { useEvents, useDepartments } from '../hooks/useQueries';

// Substituir useState e useEffect por hooks
const { data: allEvents = [], isLoading: eventsLoading } = useEvents({
    departmentId: isLeader ? leaderDepartmentId : undefined,
    startDate: '2025-01-01',
});

const { data: allDepartments = [], isLoading: deptsLoading } = useDepartments();

const loading = eventsLoading || deptsLoading;
```

**Benefícios:**
- ✅ Cache automático
- ✅ Deduplicação de requisições
- ✅ Menos código
- ✅ Loading states gerenciados automaticamente

---

#### 2. **SchedulesPage.tsx** (Eventos)
**Antes:**
```typescript
useEffect(() => {
    fetchEvents();
    fetchDepartments();
}, []);
```

**Depois:**
```typescript
import { useEvents, useDepartments } from '../hooks/useQueries';

const { data: events = [], isLoading } = useEvents({
    departmentId: leaderDepartmentId,
    startDate: '2025-01-01',
});

const { data: departments = [] } = useDepartments();
```

---

#### 3. **VolunteersPage.tsx**
**Antes:**
```typescript
const [volunteers, setVolunteers] = useState([]);

useEffect(() => {
    fetchVolunteers();
}, []);
```

**Depois:**
```typescript
import { useVolunteers } from '../hooks/useQueries';

const { data: volunteers = [], isLoading } = useVolunteers(leaderDepartmentId);
```

---

#### 4. **App.tsx** - Eventos do Dia
**Antes:**
```typescript
const [todaysEvents, setTodaysEvents] = useState<AppEvent[]>([]);

useEffect(() => {
    fetchTodaysEvents();
}, [userId, fetchTodaysEvents]);
```

**Depois:**
```typescript
import { useTodaysEvents } from './hooks/useQueries';

const { data: todaysEvents = [] } = useTodaysEvents(
    userId,
    userRole,
    userDepartmentId,
    userVolunteerId
);
```

---

#### 5. **NotificationsPage.tsx**
**Antes:**
```typescript
const [notifications, setNotifications] = useState([]);

useEffect(() => {
    fetchNotifications();
}, []);
```

**Depois:**
```typescript
import { useNotifications, useMarkNotificationAsRead } from '../hooks/useQueries';

const { data: notifications = [], isLoading } = useNotifications(userId, 15);
const markAsRead = useMarkNotificationAsRead();

// Ao marcar como lida
const handleMarkAsRead = (id: number) => {
    markAsRead.mutate(id);
};
```

---

#### 6. **TimelinesPage.tsx** (Cronogramas)
**Antes:**
```typescript
const [modelos, setModelos] = useState([]);

useEffect(() => {
    fetchModelos();
}, []);
```

**Depois:**
```typescript
import { useCronogramaModelos } from '../hooks/useQueries';

const { data: modelos = [], isLoading } = useCronogramaModelos();
```

---

### Prioridade MÉDIA

#### 7. **DepartmentsPage.tsx**
```typescript
import { useActiveDepartments } from '../hooks/useQueries';

const { data: departments = [] } = useActiveDepartments();
```

#### 8. **FrequencyPage.tsx**
```typescript
import { useActiveVolunteers } from '../hooks/useQueries';

const { data: volunteers = [] } = useActiveVolunteers();
```

---

## 🔄 Padrão de Migração

### Passo 1: Identificar Requisições
```typescript
// Procure por:
- useState para dados do servidor
- useEffect com fetch/supabase
- Funções de fetch manuais
```

### Passo 2: Substituir por Hook
```typescript
// De:
const [data, setData] = useState([]);
useEffect(() => { fetchData(); }, []);

// Para:
const { data = [], isLoading, error } = useHookName();
```

### Passo 3: Remover Código Desnecessário
```typescript
// Remover:
- useState para dados
- useEffect para fetch
- Funções de fetch manuais
- Loading states manuais
```

### Passo 4: Usar Mutations para Alterações
```typescript
// Para criar/atualizar/deletar:
const createEvent = useCreateEvent();
const updateEvent = useUpdateEvent();
const deleteEvent = useDeleteEvent();

// Uso:
createEvent.mutate(eventData, {
    onSuccess: () => {
        // Cache é invalidado automaticamente
        console.log('Evento criado!');
    },
});
```

---

## 🎯 Hooks Disponíveis

### Queries (Leitura)
- `useDepartments()` - Todos os departamentos
- `useActiveDepartments()` - Apenas ativos
- `useEvents(options)` - Eventos com filtros
- `useTodaysEvents(...)` - Eventos de hoje
- `useVolunteers(deptId)` - Voluntários
- `useActiveVolunteers()` - Voluntários ativos
- `useNotifications(userId, limit)` - Notificações
- `useUnreadNotificationsCount(userId)` - Contagem não lidas
- `useCronogramaModelos()` - Modelos de cronograma
- `useCronogramaModeloDetalhes(ids)` - Detalhes dos modelos

### Mutations (Escrita)
- `useMarkNotificationAsRead()` - Marcar notificação como lida
- `useCreateEvent()` - Criar evento
- `useUpdateEvent()` - Atualizar evento
- `useDeleteEvent()` - Deletar evento

### Utilities
- `useInvalidateQueries()` - Invalidar cache manualmente

---

## 💡 Dicas e Boas Práticas

### 1. **Sempre forneça valor padrão**
```typescript
// BOM ✅
const { data: events = [] } = useEvents();

// RUIM ❌
const { data: events } = useEvents(); // events pode ser undefined
```

### 2. **Use enabled para queries condicionais**
```typescript
const { data } = useEvents({
    departmentId,
}, {
    enabled: !!departmentId, // Só busca se tiver departmentId
});
```

### 3. **Combine loading states**
```typescript
const { isLoading: eventsLoading } = useEvents();
const { isLoading: deptsLoading } = useDepartments();

const loading = eventsLoading || deptsLoading;
```

### 4. **Use onSuccess/onError em mutations**
```typescript
const createEvent = useCreateEvent();

createEvent.mutate(data, {
    onSuccess: () => {
        toast.success('Evento criado!');
        navigate('/events');
    },
    onError: (error) => {
        toast.error('Erro ao criar evento');
    },
});
```

### 5. **Invalidar cache quando necessário**
```typescript
const { invalidateEvents } = useInvalidateQueries();

// Após uma ação importante
const handleImportantAction = async () => {
    await doSomething();
    invalidateEvents(); // Força refetch
};
```

---

## 📊 Monitoramento

### React Query DevTools
- Abra a aplicação em desenvolvimento
- Procure pelo ícone do React Query no canto inferior
- Veja todas as queries, cache, e status em tempo real

### Métricas para Acompanhar
- Número de queries ativas
- Taxa de cache hit
- Queries em loading
- Queries com erro

---

## ⚠️ Cuidados

### 1. **Não misture abordagens**
```typescript
// RUIM ❌
const [events, setEvents] = useState([]);
const { data } = useEvents(); // Confuso!

// BOM ✅
const { data: events = [] } = useEvents();
```

### 2. **Não faça fetch manual se já tem hook**
```typescript
// RUIM ❌
useEffect(() => {
    supabase.from('events').select('*').then(...);
}, []);

// BOM ✅
const { data: events } = useEvents();
```

### 3. **Cuidado com dependências infinitas**
```typescript
// RUIM ❌
const options = { departmentId }; // Novo objeto a cada render
const { data } = useEvents(options); // Refetch infinito!

// BOM ✅
const { data } = useEvents({ departmentId });
```

---

## 🎉 Resultado Esperado

### Antes da Migração:
- 40 requisições/minuto por usuário
- Requisições duplicadas
- Sem cache
- Código complexo

### Depois da Migração:
- 4-6 requisições/minuto por usuário (85-90% redução)
- Deduplicação automática
- Cache inteligente
- Código mais limpo e simples

---

## 📝 Checklist de Migração

- [ ] CalendarPage.tsx
- [ ] SchedulesPage.tsx
- [ ] VolunteersPage.tsx
- [ ] App.tsx (todaysEvents)
- [ ] NotificationsPage.tsx
- [ ] TimelinesPage.tsx
- [ ] DepartmentsPage.tsx
- [ ] FrequencyPage.tsx
- [ ] LeaderDashboard.tsx
- [ ] AdminDashboard.tsx
- [ ] VolunteerDashboard.tsx

---

## 🆘 Precisa de Ajuda?

Se encontrar problemas durante a migração:
1. Verifique os exemplos neste guia
2. Consulte a documentação do React Query
3. Use o DevTools para debug
4. Peça ajuda!
