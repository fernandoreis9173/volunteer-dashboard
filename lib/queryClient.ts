import { QueryClient } from '@tanstack/react-query';

// Configuração otimizada do QueryClient
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Cache por 5 minutos (dados raramente mudam)
            staleTime: 5 * 60 * 1000,
            // Manter cache por 10 minutos (gcTime é o novo nome para cacheTime em v5)
            gcTime: 10 * 60 * 1000,
            // Não refetch automaticamente ao focar janela (reduz requisições)
            refetchOnWindowFocus: false,
            // Não refetch ao reconectar (a menos que necessário)
            refetchOnReconnect: false,
            // Retry apenas 1 vez em caso de erro
            retry: 1,
            // Deduplicar requisições automáticas
            refetchOnMount: false,
        },
    },
});
