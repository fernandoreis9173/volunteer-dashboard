import React, { useState, useEffect, useCallback, useMemo } from 'react';
import VolunteerCard from './VolunteerCard';
import NewVolunteerForm from './NewVolunteerForm';
import ConfirmationModal from './ConfirmationModal';
import { DetailedVolunteer, Department } from '../types';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';
import Pagination from './Pagination';

interface VolunteersPageProps {
  isFormOpen: boolean;
  setIsFormOpen: (isOpen: boolean) => void;
  userRole: string | null;
  leaderDepartmentId: number | null;
}

const ITEMS_PER_PAGE = 6;

const useIsMobile = (breakpoint = 768) => { // md breakpoint
    const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);
    return isMobile;
};


const VolunteersPage: React.FC<VolunteersPageProps> = ({ isFormOpen, setIsFormOpen, userRole, leaderDepartmentId }) => {
  const [masterVolunteers, setMasterVolunteers] = useState<DetailedVolunteer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingVolunteer, setEditingVolunteer] = useState<DetailedVolunteer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [volunteerToDeleteId, setVolunteerToDeleteId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingInvites, setPendingInvites] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [volunteerToInvite, setVolunteerToInvite] = useState<DetailedVolunteer | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [volunteerToRemove, setVolunteerToRemove] = useState<DetailedVolunteer | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const isMobile = useIsMobile();


  const isLeader = userRole === 'leader' || userRole === 'lider';

  const fetchVolunteers = useCallback(async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error: fetchError } = await supabase
            .from('volunteers')
            .select('id, user_id, name, email, phone, initials, status, departments:departaments, skills, availability, created_at')
            .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        setMasterVolunteers(data as DetailedVolunteer[] || []);
      } catch (error: any) {
        const errorMessage = getErrorMessage(error);
        console.error('Error fetching volunteers:', errorMessage);
        setError(`Falha ao carregar voluntários: ${errorMessage}`);
        setMasterVolunteers([]);
      } finally {
        setLoading(false);
      }
  }, []);
  
  const fetchActiveDepartments = useCallback(async () => {
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
  }, []);

  const fetchPendingInvites = useCallback(async () => {
    if (!isLeader) return;
    const { data, error } = await supabase
      .from('invitations')
      .select('volunteer_id')
      .eq('status', 'pendente');
    if (error) {
      console.error('Error fetching pending invites:', getErrorMessage(error));
    } else {
      setPendingInvites(new Set(data.map(i => i.volunteer_id)));
    }
  }, [isLeader]);


  useEffect(() => {
    fetchVolunteers();
    fetchActiveDepartments();
    fetchPendingInvites();
  }, [fetchVolunteers, fetchActiveDepartments, fetchPendingInvites]);

  const leaderDepartmentName = useMemo(() => {
    if (isLeader && leaderDepartmentId && departments.length > 0) {
        return departments.find(d => d.id === leaderDepartmentId)?.name || null;
    }
    return null;
  }, [isLeader, leaderDepartmentId, departments]);

  const filteredVolunteers = useMemo(() => {
    if (!searchQuery) {
        return masterVolunteers;
    }
    const lowercasedQuery = searchQuery.toLowerCase();
    return masterVolunteers.filter(v => 
        v.name.toLowerCase().includes(lowercasedQuery) ||
        v.email.toLowerCase().includes(lowercasedQuery)
    );
  }, [searchQuery, masterVolunteers]);

  const paginatedVolunteers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredVolunteers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, filteredVolunteers]);

  const totalPages = Math.ceil(filteredVolunteers.length / ITEMS_PER_PAGE);
  
  const volunteersToDisplay = isMobile ? filteredVolunteers : paginatedVolunteers;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, isMobile]);

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
    if (!volunteerToDeleteId) {
        alert("Erro ao processar exclusão.");
        handleCancelDelete();
        return;
    }
    setIsDeleting(true);
    const { error: deleteError } = await supabase.from('volunteers').delete().eq('id', volunteerToDeleteId);

    if (deleteError) {
        alert(`Falha ao excluir voluntário: ${getErrorMessage(deleteError)}`);
    } else {
        await fetchVolunteers();
    }
    setIsDeleting(false);
    handleCancelDelete();
  };
  
  const handleInviteRequest = (volunteer: DetailedVolunteer) => {
    setVolunteerToInvite(volunteer);
    setIsInviteModalOpen(true);
  };

  const handleCancelInvite = () => {
    setIsInviteModalOpen(false);
    setVolunteerToInvite(null);
  };

  const handleConfirmInvite = async () => {
    if (!volunteerToInvite || !volunteerToInvite.id) return;
    setIsInviting(true);
    try {
      const { error } = await supabase.functions.invoke('invite-to-department', {
        body: { volunteerId: volunteerToInvite.id }
      });
      if (error) throw error;
      await fetchPendingInvites();
    } catch (err) {
      alert(`Falha ao enviar convite: ${getErrorMessage(err)}`);
    } finally {
      setIsInviting(false);
      handleCancelInvite();
    }
  };

  const handleRemoveFromDepartmentRequest = (volunteer: DetailedVolunteer) => {
    setVolunteerToRemove(volunteer);
    setIsRemoveModalOpen(true);
  };

  const handleCancelRemove = () => {
    setIsRemoveModalOpen(false);
    setVolunteerToRemove(null);
  };

  const handleConfirmRemoveFromDepartment = async () => {
    if (!volunteerToRemove) return;
    setIsRemoving(true);
    try {
      const { error } = await supabase.functions.invoke('remove-from-department', {
        body: { volunteerId: volunteerToRemove.id }
      });
      if (error) throw error;
      await fetchVolunteers();
    } catch (err) {
      alert(`Falha ao remover voluntário: ${getErrorMessage(err)}`);
    } finally {
      setIsRemoving(false);
      handleCancelRemove();
    }
  };

  const handleStatusChange = async (volunteerId: number, newStatus: 'Ativo' | 'Inativo') => {
    const originalVolunteers = [...masterVolunteers];
    const volunteer = masterVolunteers.find(v => v.id === volunteerId);

    if (!volunteer || !volunteer.user_id) {
        alert('Erro: Dados do voluntário incompletos. Não é possível alterar o status.');
        return;
    }

    // Optimistic UI Update
    setMasterVolunteers(prev =>
        prev.map(v => (v.id === volunteerId ? { ...v, status: newStatus } : v))
    );

    try {
        const functionName = newStatus === 'Ativo' ? 'enable-user' : 'disable-user';
        
        const { error } = await supabase.functions.invoke(functionName, { 
            body: { 
                userId: volunteer.user_id,
                volunteerId: volunteer.id
            }
        });

        if (error) {
           throw error;
        }

    } catch (error) {
        alert(`Falha ao atualizar o status: ${getErrorMessage(error)}`);
        setMasterVolunteers(originalVolunteers);
    }
  };

  const handleSaveVolunteer = async (volunteerData: Omit<DetailedVolunteer, 'created_at'> & { id?: number }) => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
        if (volunteerData.id) {
            const { id, user_id, departments, ...updatePayload } = volunteerData;
            
            const dbPayload = {
                ...updatePayload,
                departaments: departments,
            };

            const { error } = await supabase
                .from('volunteers')
                .update(dbPayload)
                .eq('id', volunteerData.id);
                
            if (error) throw error;
        } else {
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
        }
        
        await fetchVolunteers();
        hideForm();

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
          <style>{`
              .no-scrollbar::-webkit-scrollbar { display: none; }
              .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `}</style>
          
          {volunteersToDisplay.length > 0 ? (
            <>
              <div className="flex overflow-x-auto space-x-4 pb-4 md:grid md:grid-cols-2 md:space-x-0 xl:grid-cols-3 md:gap-6 no-scrollbar">
                  {volunteersToDisplay.map((volunteer) => (
                  <VolunteerCard 
                      key={volunteer.id} 
                      volunteer={volunteer} 
                      onEdit={handleEditVolunteer}
                      onDelete={handleDeleteRequest}
                      onInvite={handleInviteRequest}
                      onRemoveFromDepartment={handleRemoveFromDepartmentRequest}
                      onStatusChange={handleStatusChange}
                      isInvitePending={pendingInvites.has(volunteer.id!)}
                      userRole={userRole}
                      leaderDepartmentName={leaderDepartmentName}
                  />
                  ))}
              </div>
              {!isMobile && totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1.5">
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
            <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Voluntários</h1>
                        <p className="text-slate-500 mt-1">Gerencie os voluntários da igreja</p>
                    </div>
                    <button 
                      onClick={() => { setEditingVolunteer(null); showForm(); }}
                      className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors shadow-sm w-full md:w-auto justify-center flex-shrink-0"
                    >
                      <img 
    src="/assets/icons/newVolunteers.svg" 
    alt="Novos Voluntários" 
    className="h-5 w-5"
    style={{ filter: 'brightness(0) invert(1)' }}
/>
                      <span>Convidar Voluntário</span>
                    </button>
                </div>
                <div className="space-y-6">
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>      
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
                    {renderContent()}
                </div>
            </>
        )}

        <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={handleCancelDelete}
            onConfirm={handleConfirmDelete}
            title="Confirmar Exclusão"
            message="Tem certeza que deseja excluir este voluntário? Esta ação não pode ser desfeita."
            isLoading={isDeleting}
        />
        <ConfirmationModal
            isOpen={isInviteModalOpen}
            onClose={handleCancelInvite}
            onConfirm={handleConfirmInvite}
            title="Confirmar Convite"
            message={`Tem certeza que deseja convidar ${volunteerToInvite?.name} para o seu departamento?`}
            isLoading={isInviting}
            iconType="info"
            confirmButtonClass="bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
        />
        <ConfirmationModal
            isOpen={isRemoveModalOpen}
            onClose={handleCancelRemove}
            onConfirm={handleConfirmRemoveFromDepartment}
            title="Confirmar Remoção"
            message={`Tem certeza que deseja remover ${volunteerToRemove?.name} do seu departamento?`}
            isLoading={isRemoving}
        />
    </div>
  );
};

export default VolunteersPage;