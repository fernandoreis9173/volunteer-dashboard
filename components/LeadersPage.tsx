import React, { useState, useEffect } from 'react';
import LeaderCard from './LeaderCard';
import NewLeaderForm from './NewLeaderForm';
import ConfirmationModal from './ConfirmationModal';
import { Leader } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

interface LeadersPageProps {
  supabase: SupabaseClient | null;
  isFormOpen: boolean;
  setIsFormOpen: (isOpen: boolean) => void;
}

const LeadersPage: React.FC<LeadersPageProps> = ({ supabase, isFormOpen, setIsFormOpen }) => {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingLeader, setEditingLeader] = useState<Leader | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [leaderToDeleteId, setLeaderToDeleteId] = useState<number | null>(null);


  const fetchLeaders = async () => {
      if (!supabase) {
        setLoading(false);
        setError("Supabase client not initialized.");
        return;
      }
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('leaders')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching leaders:', fetchError);
        setError("Não foi possível carregar os líderes.");
        setLeaders([]);
      } else {
        setLeaders(data || []);
      }
      setLoading(false);
  };
  
  useEffect(() => {
    fetchLeaders();
  }, [supabase]);


  const showForm = () => {
    setSaveError(null);
    setIsFormOpen(true);
  };
  const hideForm = () => {
    setIsFormOpen(false);
    setEditingLeader(null);
  };
  
  const handleEditLeader = (leader: Leader) => {
    setEditingLeader(leader);
    showForm();
  };

  const handleDeleteRequest = (id: number) => {
    setLeaderToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setLeaderToDeleteId(null);
  };

  const handleConfirmDelete = async () => {
    if (!leaderToDeleteId || !supabase) {
        alert("Erro ao processar exclusão.");
        handleCancelDelete();
        return;
    }

    const { error: deleteError } = await supabase.from('leaders').delete().eq('id', leaderToDeleteId);

    if (deleteError) {
        alert(`Falha ao excluir líder: ${deleteError.message}`);
    } else {
        setLeaders(leaders.filter(v => v.id !== leaderToDeleteId));
    }

    handleCancelDelete();
  };

  const handleSaveLeader = async (leaderData: Omit<Leader, 'created_at'>) => {
    if (!supabase) {
      setSaveError("Conexão com o banco de dados não estabelecida.");
      return;
    }
    
    setIsSaving(true);
    setSaveError(null);

    let result;

    const payload = {
      name: leaderData.name,
      email: leaderData.email,
      phone: leaderData.phone,
      initials: leaderData.initials,
      status: leaderData.status,
      ministries: leaderData.ministries,
      skills: leaderData.skills,
      availability: leaderData.availability,
    };

    if (leaderData.id) {
      result = await supabase
        .from('leaders')
        .update(payload)
        .eq('id', leaderData.id)
        .select();
    } else {
      result = await supabase
        .from('leaders')
        .insert([payload])
        .select();
    }

    const { data, error } = result;

    if (error || !data || data.length === 0) {
        const errorMessage = error ? error.message : "A operação falhou. Verifique suas permissões ou os dados inseridos.";
        setSaveError(`Falha ao salvar: ${errorMessage}`);
        console.error("Error saving leader:", error);
    } else {
        await fetchLeaders();
        hideForm();
    }
    setIsSaving(false);
  };
  
  const filteredLeaders = leaders.filter(leader => {
    const query = searchQuery.toLowerCase();
    if (!query) return true;
    const nameMatch = leader.name.toLowerCase().includes(query);
    const emailMatch = leader.email.toLowerCase().includes(query);
    const ministriesMatch = Array.isArray(leader.ministries) && leader.ministries.some(ministry => 
        ministry.toLowerCase().includes(query)
    );
    return nameMatch || emailMatch || ministriesMatch;
  });

  const renderContent = () => {
    if (loading) {
        return <p className="text-center text-slate-500 mt-10">Carregando líderes...</p>;
    }
    if (error) {
        return <p className="text-center text-red-500 mt-10">{error}</p>;
    }
    return (
        <div className="space-y-6">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="relative flex-grow w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input 
                type="text"
                placeholder="Buscar líderes por nome, email ou ministério..."
                className="w-full pl-10 pr-4 py-2 border-0 bg-transparent rounded-lg focus:ring-0 text-slate-900"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="bg-slate-100 text-slate-600 text-sm font-semibold px-4 py-1.5 rounded-lg flex items-center space-x-2 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>{filteredLeaders.length} de {leaders.length} líderes</span>
            </div>
          </div>

          {filteredLeaders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredLeaders.map((leader) => (
                <LeaderCard 
                    key={leader.id} 
                    leader={leader} 
                    onEdit={handleEditLeader}
                    onDelete={handleDeleteRequest}
                />
                ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-slate-800">Nenhum líder encontrado</h3>
                <p className="mt-1 text-sm">Tente ajustar seus termos de busca ou adicione um novo líder.</p>
            </div>
          )}
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Líderes</h1>
          <p className="text-slate-500 mt-1">Gerencie os líderes da igreja</p>
        </div>
        <button 
          onClick={() => { setEditingLeader(null); showForm(); }}
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors shadow-sm w-full md:w-auto justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          <span>Novo Líder</span>
        </button>
      </div>

      {isFormOpen ? (
        <NewLeaderForm 
          initialData={editingLeader}
          onCancel={hideForm} 
          onSave={handleSaveLeader}
          isSaving={isSaving}
          saveError={saveError}
        />
      ) : (
        renderContent()
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este líder? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default LeadersPage;