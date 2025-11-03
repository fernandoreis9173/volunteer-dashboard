// lib/utils.ts
export const getErrorMessage = (error: any): string => {
    if (!error) {
        return 'Ocorreu um erro desconhecido.';
    }
    // NEW: Handle specific error message from Supabase function response body
    if (typeof error.context?.json?.error === 'string') {
        return error.context.json.error;
    }
    // Supabase Edge Function error structure
    if (typeof error.context?.error === 'string') {
        return error.context.error;
    }
    if (error.message) {
        // Handle Supabase client errors (e.g., from RPC calls)
        if (error.message.includes('failed to run function')) {
            return 'A função do servidor falhou. Verifique a implementação da função Edge/DB.';
        }
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    try {
        return JSON.stringify(error);
    } catch {
        return 'Ocorreu um erro não serializável.';
    }
};

export const parseArrayFromString = (data: any): string[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        if (data.startsWith('[') && data.endsWith(']')) {
            try {
                const parsed = JSON.parse(data);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) { return []; }
        }
        if (data.startsWith('{') && data.endsWith('}')) {
             return data.substring(1, data.length - 1).split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        }
        return data.split(',').map(s => s.trim()).filter(s => s);
    }
    return [];
};


export const convertUTCToLocal = (date: string, time: string): { dateTime: Date | null; fullDate: string; time: string; isValid: boolean } => {
    if (!date || !time) {
        return { dateTime: null, fullDate: '', time: '', isValid: false };
    }
    // The Supabase `time` or `timetz` column returns a time string.
    // The previous logic incorrectly appended 'Z', forcing a UTC interpretation.
    // The correct interpretation is to treat the stored date/time as being in the user's local timezone.
    // By removing the 'Z', the Date constructor will parse it in the browser's local timezone.
    const timeOnly = time.substring(0, 8);
    const localDateTime = new Date(`${date}T${timeOnly}`);

    if (isNaN(localDateTime.getTime())) {
        // Fallback for potential invalid date strings.
        console.warn(`Invalid date created from: ${date}T${timeOnly}`);
        return { dateTime: null, fullDate: 'Data Inválida', time: 'Hora Inválida', isValid: false };
    }

    const fullDate = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(localDateTime);

    const formattedTime = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(localDateTime);

    return { dateTime: localDateTime, fullDate, time: formattedTime, isValid: true };
};