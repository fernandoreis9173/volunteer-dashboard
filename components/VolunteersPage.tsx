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
  const [isSendingInviteModalOpen, setIsSendingInviteModalOpen] = useState(false);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [volunteerForAction, setVolunteerForAction] = useState<DetailedVolunteer | null>(null);
  const [actionType, setActionType] = useState<'disable' | 'enable' | null>(null);


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
                    departments ( id, name )
                )
            `)
            .order('created_at', { ascending: false });
        
        if (fetchError) throw fetchError;
        
        // Manually process the data to ensure the logic is clear.
        const transformedData = (rawVolunteers || []).map(volunteer => {
            // All relations in volunteer_departments are now considered approved.
            const approvedDepartments = (volunteer.volunteer_departments || [])
                .filter(relation => relation.departments)
                .flatMap(relation => relation.departments);
            
            // Create the final volunteer object for the state.
            return {
                ...volunteer,
                departments: approvedDepartments, // This array will ONLY contain approved departments.
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
      showNotification(`Convite enviado para ${volunteerToInvite.name}!`, 'success');
      setPendingInvites(prev => new Set(prev).add(volunteerToInvite.id!));
    } catch (err: any) {
        showNotification(`Erro ao convidar: ${getErrorMessage(err)}`, 'error');
    } finally {
        setIsInviting(false);
        handleCancelInvite();
    }
  };

  const handleSaveVolunteer = async (volunteerData: Omit<DetailedVolunteer, 'created_at' | 'departments'>, departmentIds: number[]) => {
    setSaveError(null);
    setIsSaving(true);
    if (!volunteerData.id) { // Only show loading modal for new invites
        setIsSendingInviteModalOpen(true);
    }

    const functionToCall = volunteerData.id ? 'disable-user' : 'invite-volunteer';

    try {
        const { error: invokeError } = await supabase.functions.invoke(functionToCall, {
            body: { 
              email: volunteerData.email,
              name: volunteerData.name,
              departmentIds: departmentIds
            },
        });
        
        if (invokeError) throw invokeError;
        
        showNotification(
            volunteerData.id ? 'Voluntário atualizado com sucesso!' : 'Convite enviado com sucesso!',
            'success'
        );
        hideForm();
        await fetchVolunteers();
        onDataChange();
    } catch (err) {
        setSaveError(`Falha ao salvar: ${getErrorMessage(err)}`);
    } finally {
        setIsSaving(false);
        setIsSendingInviteModalOpen(false);
    }
  };


  const handleRemoveRequest = (volunteer: DetailedVolunteer) => {
    setVolunteerToRemove(volunteer);
    setIsRemoveModalOpen(true);
  };
  
  const handleCancelRemove = () => {
    setIsRemoveModalOpen(false);
    setVolunteerToRemove(null);
  };
  
  const handleConfirmRemove = async () => {
    if (!volunteerToRemove || !volunteerToRemove.id) return;
    setIsRemoving(true);
    try {
      const { error } = await supabase.functions.invoke('remove-from-department', {
        body: { volunteerId: volunteerToRemove.id }
      });
      if (error) throw error;
      showNotification(`${volunteerToRemove.name} removido do departamento!`, 'success');
      await fetchVolunteers(); // Refetch to update the UI
    } catch (err: any) {
      showNotification(`Erro ao remover: ${getErrorMessage(err)}`, 'error');
    } finally {
      setIsRemoving(false);
      handleCancelRemove();
    }
  };

  const handleRequestAction = (volunteer: DetailedVolunteer, type: 'disable' | 'enable') => {
      setVolunteerForAction(volunteer);
      setActionType(type);
      setIsStatusModalOpen(true);
  };

  const handleConfirmAction = async () => {
      if (!volunteerForAction || !actionType) return;
      
      const functionName = actionType === 'disable' ? 'disable-user' : 'enable-user';
      
      try {
          const { error } = await supabase.functions.invoke(functionName, {
              body: { userId: volunteerForAction.user_id, volunteerId: volunteerForAction.id },
          });
  
          if (error) throw error;
          
          showNotification(`Voluntário ${actionType === 'disable' ? 'desativado' : 'reativado'} com sucesso!`, 'success');
          await fetchVolunteers(); // Refetch to update UI
  
      } catch (err: any) {
          showNotification(`Erro ao ${actionType === 'disable' ? 'desativar' : 'reativar'} voluntário: ${getErrorMessage(err)}`, 'error');
      } finally {
          setIsStatusModalOpen(false);
          setVolunteerForAction(null);
          setActionType(null);
      }
  };

  const renderContent = () => {
    if (loading) return <p className="text-center text-slate-500 mt-10">Carregando voluntários...</p>;
    if (error) return <p className="text-center text-red-500 mt-10">{error}</p>;
    return (
      <div className="space-y-6">
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                </div>
                <input 
                    type="text"
                    placeholder="Buscar por nome ou email..."
                    className="w-full pl-10 pr-4 py-2 border-0 bg-transparent rounded-lg focus:ring-0 text-slate-900"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                />
            </div>
        </div>

        {volunteersToDisplay.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {volunteersToDisplay.map((volunteer) => (
                <VolunteerCard 
                  key={volunteer.id} 
                  volunteer={volunteer}
                  onEdit={handleEditVolunteer}
                  onInvite={handleInviteRequest}
                  onRemoveFromDepartment={handleRemoveRequest}
                  onRequestAction={handleRequestAction}
                  userRole={userRole}
                  leaderDepartmentName={leaderDepartmentName}
                  isInvitePending={pendingInvites.has(volunteer.id!)}
                />
              ))}
            </div>
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <h3 className="text-lg font-medium text-slate-800">Nenhum voluntário encontrado</h3>
            <p className="mt-1 text-sm">Tente ajustar seus termos de busca ou adicione um novo voluntário.</p>
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
          <button 
            onClick={() => { setEditingVolunteer(null); showForm(); }}
            className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors shadow-sm w-full md:w-auto justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            <span>Convidar Voluntário</span>
          </button>
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
          leaderDepartmentId={leaderDepartmentId}
        />
      ) : (
        renderContent()
      )}

      <ConfirmationModal
        isOpen={isInviteModalOpen}
        onClose={handleCancelInvite}
        onConfirm={handleConfirmInvite}
        title="Confirmar Convite"
        message={`Tem certeza de que deseja convidar ${volunteerToInvite?.name} para o seu departamento?`}
        isLoading={isInviting}
        confirmButtonClass="bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
        iconType="info"
      />
      <ConfirmationModal
        isOpen={isRemoveModalOpen}
        onClose={handleCancelRemove}
        onConfirm={handleConfirmRemove}
        title="Confirmar Remoção"
        message={`Tem certeza de que deseja remover ${volunteerToRemove?.name} do seu departamento?`}
        isLoading={isRemoving}
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
        iconType="warning"
      />
       {isSendingInviteModalOpen && (
        <ConfirmationModal
            isOpen={isSendingInviteModalOpen}
            onClose={() => {}}
            onConfirm={() => {}}
            title="Enviando Convite..."
            message="Aguarde enquanto o convite é processado."
            isLoading={true}
        />
    )}
    <ConfirmationModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onConfirm={handleConfirmAction}
        title={`${actionType === 'disable' ? 'Desativar' : 'Reativar'} Voluntário`}
        message={`Tem certeza de que deseja ${actionType === 'disable' ? 'desativar' : 'reativar'} o voluntário ${volunteerForAction?.name}?`}
        isLoading={isSaving}
        confirmButtonClass={actionType === 'disable' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'}
        iconType={actionType === 'disable' ? 'warning' : 'info'}
    />
    </div>
  );
};

export default VolunteersPage;