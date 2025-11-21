# 📊 Análise de Otimização - Componentes Restantes

## 🎯 Componentes que Precisam de Migração

### **Alta Prioridade** (Fazem fetch de eventos)

#### 1. **SchedulesPage.tsx** ⚠️ CRÍTICO
**Problema**: 5 useEffect + fetch manual de eventos
**Impacto**: Página principal de eventos, muito acessada
**Código atual**:
```typescript
const [masterEvents, setMasterEvents] = useState<Event[]>([]);
const [allDepartments, setAllDepartments] = useState<Department[]>([]);
const [loading, setLoading] = useState(true);

const fetchEvents = useCallback(async () => { /* 40+ linhas */ }, []);
const fetchAllDepartments = useCallback(async () => { /* ... */ }, []);

useEffect(() => {
    fetchEvents();
    fetchAllDepartments();
}, [fetchEvents, fetchAllDepartments]);
```

**Solução**: Usar `useEvents()` e `useDepartments()`
**Redução esperada**: ~60 linhas de código, 80% menos requisições

---

#### 2. **LeaderDashboard.tsx** ⚠️ IMPORTANTE
**Problema**: 1 useEffect + fetch manual
**Impacto**: Dashboard de líderes, acessado frequentemente
**Código atual**:
```typescript
useEffect(() => {
    fetchDashboardData();
}, [fetchDashboardData]);
```

**Solução**: Usar `useEvents()` com filtro de departamento
**Redução esperada**: ~30 linhas, 70% menos requisições

---

#### 3. **AdminDashboard.tsx** ⚠️ IMPORTANTE
**Problema**: 1 useEffect + fetch manual
**Impacto**: Dashboard admin, usado para visão geral
**Código atual**:
```typescript
useEffect(() => {
    fetchDashboardData();
}, [fetchDashboardData]);
```

**Solução**: Usar `useEvents()` sem filtros
**Redução esperada**: ~30 linhas, 70% menos requisições

---

#### 4. **VolunteerDashboard.tsx** 📊 MÉDIA
**Problema**: 1 useEffect + fetch manual
**Impacto**: Dashboard de voluntários
**Código atual**:
```typescript
useEffect(() => {
    fetchMyEvents();
}, [fetchMyEvents]);
```

**Solução**: Criar hook `useMyEvents()` ou usar `useEvents()` com filtro
**Redução esperada**: ~25 linhas, 60% menos requisições

---

#### 5. **Dashboard.tsx** (Genérico) 📊 BAIXA
**Problema**: 1 useEffect
**Impacto**: Menor, usado como fallback
**Solução**: Migrar se necessário

---

## 📈 Impacto Esperado da Migração Completa

| Componente | useEffect | Linhas de Fetch | Requisições/Load | Após Migração |
|------------|-----------|-----------------|------------------|---------------|
| CalendarPage | ~~3~~ | ~~120~~ | ~~2-3~~ | ✅ **0-1** |
| SchedulesPage | 5 | ~80 | 2-3 | 🎯 **0-1** |
| LeaderDashboard | 1 | ~40 | 1-2 | 🎯 **0-1** |
| AdminDashboard | 1 | ~40 | 1-2 | 🎯 **0-1** |
| VolunteerDashboard | 1 | ~30 | 1-2 | 🎯 **0-1** |
| **TOTAL** | **11** | **~310** | **9-13** | **0-5** |

**Redução Total**: 
- Código: **~310 linhas** → **~50 linhas** (**84% redução**)
- Requisições: **9-13** → **0-5** (**62-100% redução** com cache)

---

## 🚀 Plano de Migração Sugerido

### **Fase 1: SchedulesPage** (CONCLUÍDO ✅)
- ✅ Maior impacto
- ✅ Página mais acessada
- ✅ 5 useEffect otimizados
- **Tempo estimado**: Concluído

### **Fase 2: Dashboards** (DEPOIS)
- LeaderDashboard
- AdminDashboard  
- VolunteerDashboard
- **Tempo estimado**: 10-15 min cada

---

## 🔧 Hooks Necessários

### **Já Existem** ✅
- `useEvents(options)` - Eventos com filtros
- `useDepartments()` - Departamentos
- `useInvalidateQueries()` - Invalidar cache

### **Podem Precisar** 🤔
- `useMyEvents(userId)` - Para VolunteerDashboard
- Ou usar `useEvents()` com filtro customizado

---

## 📝 Checklist de Migração

### SchedulesPage.tsx
- [x] Substituir `useState` de eventos por `useEvents()`
- [x] Substituir `useState` de departamentos por `useDepartments()`
- [x] Remover `fetchEvents()` e `fetchAllDepartments()`
- [x] Remover useEffect de fetch
- [x] Substituir `fetchEvents()` por `invalidateEvents()` após mutations
- [x] Testar filtros e paginação

### LeaderDashboard.tsx
- [ ] Substituir fetch manual por `useEvents({ departmentId })`
- [ ] Remover useEffect de fetch
- [ ] Testar estatísticas e gráficos

### AdminDashboard.tsx
- [ ] Substituir fetch manual por `useEvents()`
- [ ] Remover useEffect de fetch
- [ ] Testar visão geral

### VolunteerDashboard.tsx
- [ ] Criar hook ou usar `useEvents()` com filtro
- [ ] Remover useEffect de fetch
- [ ] Testar "Meus Eventos"

---

## ⚡ Benefícios Imediatos

1. **Performance** 🚀
   - Cache de 5-10 minutos
   - Deduplicação automática
   - Carregamento instantâneo

2. **Menos Código** 📝
   - 84% menos código de fetch
   - Mais fácil de manter
   - Menos bugs

3. **Melhor UX** ✨
   - Loading states automáticos
   - Error handling robusto
   - Navegação mais rápida

4. **Escalabilidade** 📈
   - Suporta 10x mais usuários
   - Menos carga no servidor
   - Melhor monitoramento

---

**Recomendação**: Começar com **SchedulesPage.tsx** AGORA, pois tem o maior impacto!
