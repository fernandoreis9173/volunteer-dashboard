// supabase/functions/update-department-leader/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.44.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { department_id, leader_ids } = await req.json();

    if (department_id === undefined || department_id === null) {
      throw new Error('O ID do departamento é obrigatório.');
    }
    
    if (!Array.isArray(leader_ids)) {
      throw new Error('A lista de IDs de líderes (leader_ids) é obrigatória e deve ser um array.');
    }

    // --- NEW VALIDATION: Check if any of the leaders are already assigned elsewhere ---
    if (leader_ids.length > 0) {
      const { data: conflictingLeaders, error: conflictCheckError } = await supabaseAdmin
        .from('department_leaders')
        .select('leader_id, leader:profiles(name)')
        .in('leader_id', leader_ids)
        .neq('department_id', department_id);

      if (conflictCheckError) {
        throw new Error(`Erro ao verificar conflitos de líder: ${conflictCheckError.message}`);
      }

      if (conflictingLeaders && conflictingLeaders.length > 0) {
        const leaderName = (conflictingLeaders[0] as any)?.leader?.name || 'um líder';
        throw new Error(`Não é possível atribuir. ${leaderName} já está gerenciando outro departamento.`);
      }
    }


    // --- Sync Leaders: Delete all existing, then insert all new ---
    
    // 1. Delete all current leaders for this department
    const { error: deleteError } = await supabaseAdmin
      .from('department_leaders')
      .delete()
      .eq('department_id', department_id);

    if (deleteError) {
      throw new Error(`Falha ao remover líderes antigos: ${deleteError.message}`);
    }

    // 2. Insert new leaders if any are provided
    if (leader_ids.length > 0) {
      const newLeaderAssignments = leader_ids.map(leaderId => ({
        department_id: department_id,
        leader_id: leaderId,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('department_leaders')
        .insert(newLeaderAssignments);

      if (insertError) {
        throw new Error(`Falha ao associar novos líderes: ${insertError.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Líderes do departamento atualizados com sucesso.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Erro na função update-department-leader:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});