import { supabase } from '../lib/supabaseClient';

/**
 * Envia uma mensagem via WhatsApp usando a Evolution API
 * 
 * @param number - Número do WhatsApp no formato internacional (ex: 5511999999999)
 * @param message - Mensagem a ser enviada
 * @returns Promise com o resultado do envio
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await sendWhatsAppMessage('5511999999999', 'Olá! Esta é uma mensagem de teste.');
 *   console.log('Mensagem enviada:', result);
 * } catch (error) {
 *   console.error('Erro ao enviar:', error);
 * }
 * ```
 */
export async function sendWhatsAppMessage(number: string, message: string) {
    try {
        // Validações básicas
        if (!number || !message) {
            throw new Error('Número e mensagem são obrigatórios');
        }

        // Remove caracteres especiais do número
        const cleanNumber = number.replace(/\D/g, '');

        if (cleanNumber.length < 10) {
            throw new Error('Número de telefone inválido');
        }

        // Chama a Edge Function
        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
            body: {
                number: cleanNumber,
                message: message.trim()
            }
        });

        if (error) {
            throw error;
        }

        if (!data.success) {
            throw new Error(data.error || 'Erro ao enviar mensagem');
        }

        return data;
    } catch (error: any) {
        console.error('Erro ao enviar mensagem WhatsApp:', error);
        throw new Error(error.message || 'Erro ao enviar mensagem via WhatsApp');
    }
}

/**
 * Envia mensagens em lote via WhatsApp
 * 
 * @param messages - Array de objetos com número e mensagem
 * @returns Promise com array de resultados
 * 
 * @example
 * ```typescript
 * const messages = [
 *   { number: '5511999999999', message: 'Olá João!' },
 *   { number: '5511888888888', message: 'Olá Maria!' }
 * ];
 * 
 * const results = await sendBulkWhatsAppMessages(messages);
 * console.log('Resultados:', results);
 * ```
 */
export async function sendBulkWhatsAppMessages(
    messages: Array<{ number: string; message: string }>
) {
    const results = [];

    for (const msg of messages) {
        try {
            const result = await sendWhatsAppMessage(msg.number, msg.message);
            results.push({
                number: msg.number,
                success: true,
                data: result
            });

            // Aguarda 1 segundo entre mensagens para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error: any) {
            results.push({
                number: msg.number,
                success: false,
                error: error.message
            });
        }
    }

    return results;
}

/**
 * Formata um número de telefone para o formato internacional
 * 
 * @param phone - Número de telefone em qualquer formato
 * @returns Número formatado (apenas dígitos)
 * 
 * @example
 * ```typescript
 * formatPhoneNumber('+55 (11) 99999-9999') // '5511999999999'
 * formatPhoneNumber('11 99999-9999')       // '11999999999'
 * ```
 */
export function formatPhoneNumber(phone: string): string {
    return phone.replace(/\D/g, '');
}

/**
 * Valida se um número de telefone é válido
 * 
 * @param phone - Número de telefone
 * @returns true se válido, false caso contrário
 */
export function isValidPhoneNumber(phone: string): boolean {
    const cleaned = formatPhoneNumber(phone);
    return cleaned.length >= 10 && cleaned.length <= 15;
}
