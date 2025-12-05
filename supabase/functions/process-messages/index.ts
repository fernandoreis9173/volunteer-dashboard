import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const BATCH_SIZE = 100; // Processar 100 mensagens por vez

    // 1. Buscar mensagens pendentes
    const { data: messages, error: fetchError } = await supabaseClient
      .from('pending_messages')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) throw fetchError;

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({
        message: 'Nenhuma mensagem pendente',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📤 Processando ${messages.length} mensagens...`);

    // 2. Marcar como "sending" para evitar duplicação
    const messageIds = messages.map(m => m.id);
    await supabaseClient
      .from('pending_messages')
      .update({ status: 'sending' })
      .in('id', messageIds);

    // 3. Buscar configurações do WhatsApp
    const { data: whatsappSettings } = await supabaseClient
      .from('whatsapp_settings')
      .select('*')
      .eq('active', true)
      .single();

    if (!whatsappSettings) {
      console.error('❌ WhatsApp não configurado');
      // Reverter status
      await supabaseClient
        .from('pending_messages')
        .update({ status: 'pending' })
        .in('id', messageIds);

      return new Response(JSON.stringify({
        error: 'WhatsApp não configurado'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    // 4. Processar mensagens em paralelo
    const results = await Promise.allSettled(
      messages.map(async (msg) => {
        try {
          // Enviar WhatsApp
          if (msg.volunteer_phone) {
            const formattedNumber = msg.volunteer_phone.replace(/\D/g, '');

            const response = await fetch(
              `${whatsappSettings.evolution_url}/message/sendText/${whatsappSettings.session_name}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': whatsappSettings.token,
                },
                body: JSON.stringify({
                  number: formattedNumber,
                  text: msg.message_content
                })
              }
            );

            const evolutionData = await response.json();

            if (!response.ok) {
              throw new Error(`WhatsApp API error: ${response.status} - ${JSON.stringify(evolutionData)}`);
            }

            // Log de sucesso
            await supabaseClient.from('whatsapp_logs').insert({
              recipient_phone: formattedNumber,
              message_content: msg.message_content,
              status: 'success',
              response_data: evolutionData
            });
          }

          // Marcar como enviado
          await supabaseClient
            .from('pending_messages')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', msg.id);

          return { id: msg.id, success: true };

        } catch (error) {
          console.error(`❌ Erro ao enviar mensagem ${msg.id}:`, error.message);

          // Incrementar retry
          const newRetryCount = msg.retry_count + 1;
          const newStatus = newRetryCount >= 3 ? 'failed' : 'pending';

          await supabaseClient
            .from('pending_messages')
            .update({
              status: newStatus,
              retry_count: newRetryCount,
              error_message: error.message
            })
            .eq('id', msg.id);

          return { id: msg.id, success: false, error: error.message };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`✅ Processamento concluído: ${successful} sucesso, ${failed} falhas`);

    return new Response(JSON.stringify({
      processed: messages.length,
      successful,
      failed,
      message: `Processadas ${messages.length} mensagens (${successful} OK, ${failed} falhas)`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no process-messages:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
