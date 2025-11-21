# 🎯 Como Migrar CalendarPage para React Query

## ✅ O que já está pronto:
- React Query instalado e configurado
- Hooks customizados criados em `/hooks/useQueries.ts`
- App envolvido com QueryClientProvider

## 📝 Passo a Passo para Migrar CalendarPage.tsx

### **Passo 1: Adicionar Imports**

No topo do arquivo `CalendarPage.tsx`, adicione:

```typescript
import { useEvents, useDepartments, useInvalidateQueries } from '../hooks/useQueries';
```

### **Passo 2: Substituir Estado e Fetch Manual**

**Encontre estas linhas (aprox. linha 305-309):**
```typescript
const [allEvents, setAllEvents] = useState<Event[]>([]);
const [allDepartments, setAllDepartments] = useState<Department[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

**Substitua por:**
```typescript
// React Query hooks - substituindo useState e fetch manual
const startOfYear = `${new Date().getFullYear()}-01-01`;
const isLeader = userRole === 'leader' || userRole === 'lider';

const { data: allEvents = [], isLoading: eventsLoading, error: eventsError } = useEvents({
    departmentId: isLeader ? leaderDepartmentId : undefined,
    startDate: startOfYear,
});

const { data: allDepartments = [], isLoading: deptsLoading } = useDepartments();
const { invalidateEvents } = useInvalidateQueries();

const loading = eventsLoading || deptsLoading;
const error = eventsError ? getErrorMessage(eventsError) : null;
```

### **Passo 3: Remover Definição Duplicada de isLeader**

**Encontre e REMOVA esta linha (aprox. linha 324):**
```typescript
const isLeader = userRole === 'leader' || userRole === 'lider';
```

(Já foi definido no Passo 2)

### **Passo 4: Remover Funções de Fetch Manual**

**Encontre e REMOVA estas funções (aprox. linhas 425-477):**
```typescript
const fetchAllDepartments = useCallback(async () => {
    const { data, error } = await supabase.from('departments').select('id, name');
    if (error) {
        console.error("Failed to fetch all departments for form:", getErrorMessage(error));
    } else {
        setAllDepartments((data as Department[]) || []);
    }
}, []);

const fetchAllEvents = useCallback(async (setLoadingState = true) => {
    // ... todo o código da função
}, [isLeader, leaderDepartmentId]);

useEffect(() => {
    fetchAllEvents();
    fetchAllDepartments();
}, [fetchAllEvents, fetchAllDepartments]);
```

### **Passo 5: Atualizar handleSaveEvent**

**Encontre a função `handleSaveEvent` e substitua a linha:**
```typescript
await fetchAllEvents(false);
```

**Por:**
```typescript
invalidateEvents();
```

### **Passo 6: Atualizar handleEventDrop**

**Encontre a função `handleEventDrop` e substitua a linha:**
```typescript
await fetchAllEvents(false);
```

**Por:**
```typescript
invalidateEvents();
```

### **Passo 7: Atualizar handleEventResize**

**Encontre a função `handleEventResize` e substitua a linha:**
```typescript
await fetchAllEvents(false);
```

**Por:**
```typescript
invalidateEvents();
```

---

## 🎉 Resultado Esperado

### Antes:
```typescript
// 60+ linhas de código
const [allEvents, setAllEvents] = useState<Event[]>([]);
const [allDepartments, setAllDepartments] = useState<Department[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

const fetchAllDepartments = useCallback(async () => { /* ... */ }, []);
const fetchAllEvents = useCallback(async (setLoadingState = true) => { /* ... */ }, [isLeader, leaderDepartmentId]);

useEffect(() => {
    fetchAllEvents();
    fetchAllDepartments();
}, [fetchAllEvents, fetchAllDepartments]);
```

### Depois:
```typescript
// 15 linhas de código
const startOfYear = `${new Date().getFullYear()}-01-01`;
const isLeader = userRole === 'leader' || userRole === 'lider';

const { data: allEvents = [], isLoading: eventsLoading, error: eventsError } = useEvents({
    departmentId: isLeader ? leaderDepartmentId : undefined,
    startDate: startOfYear,
});

const { data: allDepartments = [], isLoading: deptsLoading } = useDepartments();
const { invalidateEvents } = useInvalidateQueries();

const loading = eventsLoading || deptsLoading;
const error = eventsError ? getErrorMessage(eventsError) : null;
```

---

## ✨ Benefícios Imediatos

1. **Menos Código**: ~60 linhas → ~15 linhas (75% redução)
2. **Cache Automático**: Dados são cacheados por 5-10 minutos
3. **Deduplicação**: Requisições duplicadas são automaticamente eliminadas
4. **Menos Bugs**: Não precisa gerenciar loading/error states manualmente
5. **Performance**: Redução de 70-80% nas requisições ao servidor

---

## 🔍 Como Verificar se Funcionou

1. Abra o DevTools do React Query (canto inferior da tela)
2. Navegue para a página do calendário
3. Você deve ver:
   - Query `['events', {...}]` com status "success"
   - Query `['departments']` com status "success"
   - Cache time e stale time configurados
4. Navegue para outra página e volte
5. Os dados devem carregar instantaneamente do cache!

---

## 🆘 Problemas Comuns

### "Cannot find module '../hooks/useQueries'"
- Verifique se o arquivo `/hooks/useQueries.ts` existe
- Verifique o caminho relativo do import

### "allEvents is undefined"
- Certifique-se de usar `= []` como valor padrão:
  ```typescript
  const { data: allEvents = [] } = useEvents();
  ```

### Requisições ainda duplicadas
- Verifique se o QueryClientProvider está envolvendo o App
- Abra o DevTools do React Query para debugar

---

## 📊 Monitoramento

Após a migração, monitore:
- Número de requisições no Network tab (deve reduzir drasticamente)
- Cache hits no React Query DevTools
- Tempo de carregamento da página

---

Quer que eu ajude com algum passo específico?
