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