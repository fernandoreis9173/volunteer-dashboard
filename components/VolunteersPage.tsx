import React, { useState, useEffect, useCallback, useMemo } from 'react';
import VolunteerCard from './VolunteerCard';
import NewVolunteerForm from './NewVolunteerForm';
import ConfirmationModal from './ConfirmationModal';
import { DetailedVolunteer, Department, Event } from '../types';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';
import Pagination from './Pagination';
import QRScannerModal from './QRScannerModal';

interface VolunteersPageProps {
  isFormOpen: boolean;
  setIsFormOpen: (isOpen: boolean) => void;
  userRole: string | null;
  leaderDepartmentId: number | null;
  activeEvent: Event | null;
  onDataChange: () => void;
}

const ITEMS_PER_PAGE = 6;

const VolunteersPage: React.FC<VolunteersPageProps> = ({ isFormOpen, setIsFormOpen, userRole, leaderDepartmentId, activeEvent, onDataChange }) => {
  const [masterVolunteers, setMasterVolunteers] = useState<DetailedVolunteer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingVolunteer, setEditingVolunteer] = useState<DetailedVolunteer | null>(null);
  const [inputValue, setInputValue] = useState(''); // For immediate input
  const [searchQuery, setSearchQuery] = useState(''); // For debounced filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [volunteerToInvite, setVolunteerToInvite] = useState<DetailedVolunteer | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Set<number>>(new Set());

  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [volunteerToRemove, setVolunteerToRemove] = useState<DetailedVolunteer | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [leaderDepartmentName, setLeaderDepartmentName] = useState<string | null>(null);


  const isLeader = userRole === 'leader' || userRole === 'lider';
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
        setSearchQuery(inputValue);
    }, 300); // 300ms delay

    return () => {
        clearTimeout(timer);
    };
  }, [inputValue]);

  useEffect(() => {
    if (isLeader && leaderDepartmentId) {
        const fetchDeptName = async () => {
            const { data, error } = await supabase.from('departments').select('name').eq('id', leaderDepartmentId).single();
            if (data) setLeaderDepartmentName(data.name);
            else console.error("Could not fetch leader department name", error);
        };
        fetchDeptName();
    }
  }, [isLeader, leaderDepartmentId]);


  const fetchVolunteers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
        // Fetch all volunteers and all their department relationships.
        const { data: rawVolunteers, error: fetchError } = await supabase
            .from('volunteers')
            .select(`
                id,
                user_id,
                name,
                email,
                phone,
                initials,
                status,
                skills,
                availability,
                created_at,
                volunteer_departments (
                    department_id,
                    status,
                    departments ( id, name )
                )
            `)
            .order('created_at', { ascending: false });
        
        if (fetchError) throw fetchError;
        
        // Manually process the data to ensure the logic is clear.
        const transformedData = (rawVolunteers || []).map(volunteer => {
            // FIX: Used `flatMap` instead of `map` to correctly flatten the nested array of department objects returned by the Supabase query. This resolves the TypeScript error where `departments` was being typed as `Department[][]` instead of `Department[]`.
            const approvedDepartments = (volunteer.volunteer_departments || [])
                .filter(relation => relation.status === 'aprovado' && relation.departments)
                .flatMap(relation => relation.departments);
            
            // Create the final volunteer object for the state.
            return {
                ...volunteer,
                departments: approvedDepartments, // This array will only contain approved departments.
                // We keep the raw relations if needed elsewhere, but 'departments' is the clean one.
                volunteer_departments: volunteer.volunteer_departments 
            };
        });

        setMasterVolunteers(transformedData as unknown as DetailedVolunteer[]);

        // Also fetch pending invites for the leader's department
        if (isLeader && leaderDepartmentId) {
          const { data: invitesData, error: invitesError } = await supabase
            .from('invitations')
            .select('volunteer_id')
            .eq('department_id', leaderDepartmentId)
            .eq('status', 'pendente');

          if (invitesError) throw invitesError;
          
          setPendingInvites(new Set(invitesData.map(i => i.volunteer_id)));
        }

    } catch (error: any) {
        const errorMessage = getErrorMessage(error);
        console.error('Error fetching volunteers:', errorMessage);
        setError(`Falha ao carregar voluntários: ${errorMessage}`);
        setMasterVolunteers([]);
    } finally {
        setLoading(false);
    }
}, [isLeader, leaderDepartmentId]);
  
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

  useEffect(() => {
    fetchVolunteers();
    fetchActiveDepartments();
  }, [fetchVolunteers, fetchActiveDepartments]);

  const filteredVolunteers = useMemo(() => {
    let volunteers = masterVolunteers;

    if (!searchQuery) {
        return volunteers;
    }
    const lowercasedQuery = searchQuery.toLowerCase();
    return volunteers.filter(v => 
        v.name.toLowerCase().includes(lowercasedQuery) ||
        v.email.toLowerCase().includes(lowercasedQuery)
    );
  }, [searchQuery, masterVolunteers]);

  const paginatedVolunteers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredVolunteers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, filteredVolunteers]);

  const totalPages = Math.ceil(filteredVolunteers.length / ITEMS_PER_PAGE);
  
  const volunteersToDisplay = paginatedVolunteers;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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
  
  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const handleScanSuccess = useCallback(async (decodedText: string) => {
    setIsScannerOpen(false);

    if (!activeEvent || !leaderDepartmentId) {
        showNotification('Não há evento ativo ou departamento de líder definido para marcar a presença.', 'error');
        return;
    }

    try {
        const data = JSON.parse(decodedText);
        if (!data.vId || !data.eId || !data.dId) {
            throw new Error("QR Code inválido: Faltando dados essenciais.");
        }
        if (data.eId !== activeEvent.id) {
            throw new Error("Este QR Code é para um evento diferente.");
        }
        if (data.dId !== leaderDepartmentId) {
            throw new Error("Este voluntário não pertence ao seu departamento para este evento.");
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
            throw new Error("Sessão de usuário não encontrada. Por favor, faça login novamente.");
        }

        const { error: invokeError } = await supabase.functions.invoke('mark-attendance', {
            headers: {
                Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: { volunteerId: data.vId, eventId: data.eId, departmentId: data.dId },
        });

        if (invokeError) throw invokeError;
        
        const volunteer = masterVolunteers.find(v => v.id === data.vId);
        const volunteerName = volunteer?.name || 'Voluntário';
        showNotification(`Presença de ${volunteerName} confirmada com sucesso!`, 'success');
        onDataChange();
        
    } catch (err: any) {
        if (err.context && typeof err.context.json === 'function') {
            try {
                const errorJson = await err.context.json();
                if (errorJson && errorJson.error) {
                    showNotification(errorJson.error, 'error');
                } else {
                    showNotification(getErrorMessage(err), 'error');
                }
            } catch (parseError) {
                showNotification(getErrorMessage(err), 'error');
            }
        } else {
            showNotification(getErrorMessage(err), 'error');
        }
    }
}, [activeEvent, leaderDepartmentId, showNotification, masterVolunteers, onDataChange]);


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
      await fetchVolunteers();
      showNotification(`Convite enviado para ${volunteerToInvite.name}.`, 'success');
    } catch (err) {
      showNotification(`Falha ao convidar voluntário: ${getErrorMessage(err)}`, 'error');
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

  const handleSaveVolunteer = async (volunteerData: any, departmentIds: number[]) => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
        if (!volunteerData.id) { // New user invitation
            const { error: inviteError } = await supabase.functions.invoke('invite-volunteer', {
                body: { name: volunteerData.name, email: volunteerData.email },
            });
            if (inviteError) throw inviteError;
        } else { // Editing existing volunteer
            const { error: saveError } = await supabase.functions.invoke('save-volunteer-profile', {
                body: { 
                    volunteerData: { ...volunteerData, id: volunteerData.id }, 
                    departmentIds: departmentIds 
                },
            });
            if (saveError) throw saveError;
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
          {volunteersToDisplay.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {volunteersToDisplay.map((volunteer) => {
                    return (
                        <VolunteerCard 
                            key={volunteer.id} 
                            volunteer={volunteer} 
                            onEdit={handleEditVolunteer}
                            onInvite={handleInviteRequest}
                            onRemoveFromDepartment={handleRemoveFromDepartmentRequest}
                            onStatusChange={handleStatusChange}
                            userRole={userRole}
                            leaderDepartmentName={leaderDepartmentName}
                            isInvitePending={pendingInvites.has(volunteer.id!)}
                        />
                    )
                  })}
              </div>
              {totalPages > 1 && (
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m-7.5-2.226a3 3 0 0 0-4.682 2.72 9.094 9.094 0 0 0 3.741.479m7.5-2.226V18a2.25 2.25 0 0 1-2.25 2.25H12a2.25 2.25 0 0 1-2.25-2.25v-.226m3.75-10.5a3.375 3.375 0 0 0-6.75 0v1.5a3.375 3.375 0 0 0 6.75 0v-1.5Z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-slate-800">Nenhum voluntário encontrado</h3>
                <p className="mt-1 text-sm">Tente ajustar seus termos de busca ou convide um novo voluntário.</p>
            </div>
          )}
        </div>
      );
  };

  return (
    <div className="space-y-6">
      {notification && (
          <div className={`fixed top-20 right-4 z-[9999] p-4 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
              {notification.message}
          </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Voluntários</h1>
          <p className="text-slate-500 mt-1">Gerencie os voluntários de sua organização.</p>
        </div>
        {!isFormOpen && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            {isLeader && activeEvent && (
                <button 
                  onClick={() => setIsScannerOpen(true)}
                  className="bg-teal-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-teal-600 transition-colors shadow-sm w-full md:w-auto justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
                  </svg>
                  <span>Presença Rápida</span>
                </button>
            )}
            <button 
              onClick={() => { setEditingVolunteer(null); showForm(); }}
              className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors shadow-sm w-full md:w-auto justify-center"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Novo Voluntário</span>
            </button>
          </div>
        )}
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

      {isScannerOpen && (
          <QRScannerModal
              isOpen={isScannerOpen}
              onClose={() => setIsScannerOpen(false)}
              onScanSuccess={handleScanSuccess}
              scanningEventName={activeEvent?.name}
          />
      )}
      <ConfirmationModal
        isOpen={isInviteModalOpen}
        onClose={handleCancelInvite}
        onConfirm={handleConfirmInvite}
        title="Convidar Voluntário"
        message={`Tem certeza que deseja convidar ${volunteerToInvite?.name} para seu departamento?`}
        isLoading={isInviting}
        confirmButtonClass="bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
        iconType="info"
      />
      <ConfirmationModal
        isOpen={isRemoveModalOpen}
        onClose={handleCancelRemove}
        onConfirm={handleConfirmRemoveFromDepartment}
        title="Remover Voluntário"
        message={`Tem certeza que deseja remover ${volunteerToRemove?.name} do seu departamento?`}
        isLoading={isRemoving}
      />
    </div>
  );
};

export default VolunteersPage;
