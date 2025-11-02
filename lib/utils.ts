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
    if (typeof error.context?.error?.error === 'string') {
        return error.context.error.error;
    }
    if (typeof error.context?.error === 'string') {
        return error.context.error;
    }
    if (typeof error.context?.error?.message === 'string') {
        return error.context.error.message;
    }
    // PostgREST error structure
    if (typeof error.details === 'string' && error.details.length > 0) {
        return `${error.message} (${error.details})`;
    }
    // Generic JS error
    if (typeof error.message === 'string') {
        return error.message;
    }
    // Fallback for unknown error shapes
    try {
        const stringified = JSON.stringify(error);
        if (stringified !== '{}' && stringified !== '[]') return stringified;
    } catch (e) {
        // ignore stringify errors
    }
    return 'Ocorreu um erro desconhecido. Tente novamente.';
};


export const parseArrayFromString = (data: string[] | string | null | undefined): string[] => {
    let items: string[] = [];
    if (!data) return [];

    if (Array.isArray(data)) {
        items = data;
    } else if (typeof data === 'string') {
        if (data.startsWith('[') && data.endsWith(']')) {
            try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) items = parsed;
            } catch (e) { /* ignore */ }
        }
        else if (data.startsWith('{') && data.endsWith('}')) {
             items = data.substring(1, data.length - 1).split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        }
        else if (data.trim()) {
            items = data.split(',').map(s => s.trim());
        }
    }
    return items.filter(item => item && item.trim() !== '');
};

// FIX: Add and export the 'formatPhoneNumber' utility function.
export const formatPhoneNumber = (value: string) => {
    if (!value) return '';
    const phoneNumber = value.replace(/\D/g, '').slice(0, 11);
    const { length } = phoneNumber;
    if (length <= 2) return `(${phoneNumber}`;
    if (length <= 6) return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2)}`;
    if (length <= 10) return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 6)}-${phoneNumber.slice(6)}`;
    return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 7)}-${phoneNumber.slice(7)}`;
};

export const convertUTCToLocal = (utcDateStr: string, utcTimeStr: string) => {
    if (!utcDateStr || !utcTimeStr) {
      return {
        date: '',
        time: '',
        fullDate: '',
        dateTime: null,
        isValid: false,
      };
    }
    const date = new Date(`${utcDateStr}T${utcTimeStr}Z`);
    if (isNaN(date.getTime())) {
      return {
        date: 'Data inválida',
        time: 'Hora inválida',
        fullDate: 'Data/Hora inválida',
        dateTime: null,
        isValid: false,
      };
    }
  
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
    return {
      date: date.toLocaleDateString('pt-BR', { timeZone }),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone }),
      fullDate: date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone,
      }),
      dateTime: date,
      isValid: true,
    };
  };