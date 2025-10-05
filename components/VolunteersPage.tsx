import React, { useState, useEffect, useCallback } from 'react';
import VolunteerCard from './VolunteerCard';
import NewVolunteerForm from './NewVolunteerForm';
import ConfirmationModal from './ConfirmationModal';
import { DetailedVolunteer, Department } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/utils';

// Debounce hook
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

interface VolunteersPageProps {
  supabase: SupabaseClient | null;
  isFormOpen: boolean;
  setIsFormOpen: (isOpen: boolean) => void;
  userRole: string | null;
  onDataChange: () => void;
}

const VolunteersPage: React.FC<VolunteersPageProps> = ({ supabase, isFormOpen, setIsFormOpen, userRole, onDataChange }) => {
  const [allVolunteers, setAllVolunteers] = useState<DetailedVolunteer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingVolunteer, setEditingVolunteer] = useState<DetailedVolunteer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [volunteerToDeleteId, setVolunteerToDeleteId] = useState<number | null>(null);
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const fetchVolunteers = useCallback(async (query: string) => {
      if (!supabase) {
        setLoading(false);
        setError("Supabase client not initialized.");
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        let queryBuilder = supabase
            .from('volunteers')
            .select('id, user_id, name, email, phone, initials, status, departments:departaments, skills, availability, created_at')
            .order('created_at', { ascending: false });

        if (query) {
            queryBuilder = queryBuilder.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
        }

        const { data, error: fetchError } = await queryBuilder;
        if (fetchError) throw fetchError;

        setAllVolunteers(data as DetailedVolunteer[] || []);
      } catch (error: any) {
        const errorMessage = getErrorMessage(error);
        console.error('Error fetching volunteers:', errorMessage);
        setError(`Falha ao carregar voluntários: ${errorMessage}`);
        setAllVolunteers([]);
      } finally {
        setLoading(false);
      }
  }, [supabase]);
  
  const fetchActiveDepartments = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('status', 'Ativo')
        .order('name', { ascending: true });
    if (error) {
        console.error('Error fetching active departments:', getErrorMessage(error));
    } else {
        setDepartments(data as Department[] || []);
    }
  }, [supabase]);

  useEffect(() => {
    fetchVolunteers(debouncedSearchQuery);
  }, [debouncedSearchQuery, fetchVolunteers]);

  useEffect(() => {
    fetchActiveDepartments();
  }, [fetchActiveDepartments]);

  const showForm = () => {
    setSaveError(null);
    setIsFormOpen(true);
  };
  const hideForm = () => {
    setIsFormOpen(false);
    setEditingVolunteer(null);
  };
  
  const handleEditVolunteer = (volunteer: DetailedVolunteer) => {
    setEditingVolunteer(volunteer);
    showForm();
  };

  const handleDeleteRequest = (id: number) => {
    setVolunteerToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setVolunteerToDeleteId(null);
  };

  const handleConfirmDelete = async () => {
    if (!volunteerToDeleteId || !supabase) {
        alert("Erro ao processar exclusão.");
        handleCancelDelete();
        return;
    }

    const { error: deleteError } = await supabase.from('volunteers').delete().eq('id', volunteerToDeleteId);

    if (deleteError) {
        alert(`Falha ao excluir voluntário: ${getErrorMessage(deleteError)}`);
    } else {
        setAllVolunteers(allVolunteers.filter(v => v.id !== volunteerToDeleteId));
        onDataChange();
    }

    handleCancelDelete();
  };

  const handleSaveVolunteer = async (volunteerData: Omit<DetailedVolunteer, 'created_at'> & { id?: number }) => {
    if (!supabase) {
      setSaveError("Conexão com o banco de dados não estabelecida.");
      return;
    }
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
        if (volunteerData.id) { // Update existing volunteer
            const { id, user_id, departments, ...updatePayload } = volunteerData;
            
            const dbPayload = {
                ...updatePayload,
                departaments: departments,
            };

            const { data, error } = await supabase
                .from('volunteers')
                .update(dbPayload)
                .eq('id', volunteerData.id)
                .select('id, user_id, name, email, phone, initials, status, departments:departaments, skills, availability, created_at')
                .single();
                
            if (error) throw error;
            
            setAllVolunteers(allVolunteers.map(v => v.id === data.id ? (data as DetailedVolunteer) : v));
        } else { // Invite new volunteer
            const invitePayload = {
                name: volunteerData.name,
                email: volunteerData.email,
            };

            const { error: invokeError } = await supabase.functions.invoke('invite-volunteer', {
                body: invitePayload,
            });

            if (invokeError) {
                throw invokeError;
            }
            
            await fetchVolunteers(searchQuery);
        }
        hideForm();
        onDataChange();
    } catch(error: any) {
        const errorMessage = getErrorMessage(error);
        setSaveError(`Falha ao salvar: ${errorMessage}`);
        console.error("Error saving/inviting volunteer:", error);
    } finally {
        setIsSaving(false);
    }
  };


  const renderContent = () => {
    if (loading) {
        return <p className="text-center text-slate-500 mt-10">Carregando voluntários...</p>;
    }
    if (error) {
        return <p className="text-center text-red-500 mt-10">{error}</p>;
    }
    return (
        <div className="space-y-6">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="relative flex-grow w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <input 
                type="text"
                placeholder="Buscar voluntários por nome ou email..."
                className="w-full pl-10 pr-4 py-2 border-0 bg-transparent rounded-lg focus:ring-0 text-slate-900"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {allVolunteers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {allVolunteers.map((volunteer) => (
                <VolunteerCard 
                    key={volunteer.id} 
                    volunteer={volunteer} 
                    onEdit={handleEditVolunteer}
                    onDelete={handleDeleteRequest}
                />
                ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m-7.5-2.226a3 3 0 0 0-4.682 2.72 9.094 9.094 0 0 0 3.741.479m7.5-2.226V18a2.25 2.25 0 0 1-2.25 2.25H12a2.25 2.25 0 0 1-2.25-2.25V18.226m3.75-10.5a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5ZM10.5 8.25a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5Z" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-slate-800">Nenhum voluntário encontrado</h3>
                <p className="mt-1 text-sm">Tente ajustar seus termos de busca ou adicione um novo voluntário.</p>
            </div>
          )}
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Voluntários</h1>
          <p className="text-slate-500 mt-1">Gerencie os voluntários da igreja</p>
        </div>
        <button 
          onClick={() => { setEditingVolunteer(null); showForm(); }}
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors shadow-sm w-full md:w-auto justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
          </svg>
          <span>Convidar Voluntário</span>
        </button>
      </div>

      {isFormOpen ? (
        <NewVolunteerForm 
          initialData={editingVolunteer}
          onCancel={hideForm} 
          onSave={handleSaveVolunteer}
          isSaving={isSaving}
          saveError={saveError}
          departments={departments}
          userRole={userRole}
        />
      ) : (
        renderContent()
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este voluntário? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default VolunteersPage;
