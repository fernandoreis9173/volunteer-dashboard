import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DepartmentCard from './DepartmentCard';
import NewDepartmentForm from './NewDepartmentForm';
import ConfirmationModal from './ConfirmationModal';
import { Department } from '../types';
import { supabase } from '../lib/supabaseClient';
// FIX: Use 'type' import for User to resolve potential module resolution issues with Supabase v2.
import { type User } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/utils';
import Pagination from './Pagination';

interface DepartmentsPageProps {
  userRole: string | null;
  leaderDepartmentId: number | null;
  leaders: User[];
  onLeadersChange: () => void;
}

const ITEMS_PER_PAGE = 9;

const DepartmentsPage: React.FC<DepartmentsPageProps> = ({ userRole, leaderDepartmentId, leaders, onLeadersChange }) => {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [masterDepartments, setMasterDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [inputValue, setInputValue] = useState(''); // Immediate value from input
  const [searchQuery, setSearchQuery] = useState(''); // Debounced value for filtering
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [departmentToDeleteId, setDepartmentToDeleteId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

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

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Fetch all departments
      const { data: departmentsData, error: departmentsError } = await supabase
        .from('departments')
        .select('*')
        .order('name', { ascending: true });

      if (departmentsError) throw departmentsError;

      // Step 2: Fetch all leader relationships
      const { data: leadersData, error: leadersError } = await supabase
        .from('department_leaders')
        .select('department_id, leader_id');
      
      if (leadersError) throw leadersError;

      // Step 3: Join them in the client
      const leadersByDept = new Map<number, { id: string; name: string }[]>();
      leadersData.forEach(rel => {
        if (!leadersByDept.has(rel.department_id)) {
          leadersByDept.set(rel.department_id, []);
        }
        leadersByDept.get(rel.department_id)!.push({ id: rel.leader_id, name: '' }); // Name is enriched later
      });

      const depts = (departmentsData || []).map((d: any) => ({
        ...d,
        leaders: leadersByDept.get(d.id) || []
      }));
      
      setMasterDepartments(depts as Department[]);

    } catch (fetchError) {
      const errorMessage = getErrorMessage(fetchError);
      console.error('Error fetching departments:', errorMessage);
      setError(`Não foi possível carregar os departamentos: ${errorMessage}`);
      setMasterDepartments([]);
    } finally {
      setLoading(false);
    }
  }, []);


  // FIX: Removed internal fetchLeaders logic as leaders are now passed via props.
  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);
  
  const enrichedDepartments = useMemo(() => {
    return masterDepartments.map(dept => {
        const deptLeaders = dept.leaders.map(leaderInfo => {
          const leaderUser = leaders.find(l => l.id === leaderInfo.id);
          return {
            id: leaderInfo.id,
            name: leaderUser?.user_metadata?.name || 'Líder não encontrado'
          };
        });

        return {
            ...dept,
            leaders: deptLeaders, // Now with names
            // For filtering and backward compatibility where single leader is assumed
            leader: deptLeaders.map(l => l.name).join(', ') || 'Não atribuído', 
            leader_id: deptLeaders[0]?.id || null
        };
    });
  }, [masterDepartments, leaders]);
  
  const filteredDepartments = useMemo(() => {
    let departments = [...enrichedDepartments];

    if (isLeader && leaderDepartmentId) {
      departments = departments.filter(d => d.id === leaderDepartmentId);
    }

    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        return departments.filter(d => 
            d.name.toLowerCase().includes(lowercasedQuery) ||
            (d.leader && d.leader.toLowerCase().includes(lowercasedQuery))
        );
    }
    return departments;
  }, [searchQuery, enrichedDepartments, isLeader, leaderDepartmentId]);

  const paginatedDepartments = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDepartments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, filteredDepartments]);

  const totalPages = Math.ceil(filteredDepartments.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const showForm = () => {
    setSaveError(null);
    setIsFormVisible(true);
  };
  const hideForm = () => {
    setIsFormVisible(false);
    setEditingDepartment(null);
  };

  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    showForm();
  };
  
  const handleDeleteRequest = (id: number) => {
    setDepartmentToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setDepartmentToDeleteId(null);
  };

  const handleConfirmDelete = async () => {
    if (!departmentToDeleteId) return;

    const { error: deleteError } = await supabase.from('departments').delete().eq('id', departmentToDeleteId);

    if (deleteError) {
      alert(`Falha ao excluir departamento: ${getErrorMessage(deleteError)}`);
    } else {
      await fetchDepartments();
    }
    handleCancelDelete();
  };
  
  // FIX: Rewrote the handleSaveDepartment function to support multiple leaders, matching the NewDepartmentForm's onSave signature
  // and correctly calling the `update-department-leader` Supabase function.
  const handleSaveDepartment = async (departmentData: Omit<Department, 'created_at' | 'leaders'> & { leaders: any[] }, leader_ids: string[]) => {
    setIsSaving(true);
    setSaveError(null);

    try {
        const { leaders, ...dbPayload } = departmentData;
        
        const { data: savedDept, error: deptError } = await supabase
            .from('departments')
            .upsert(dbPayload)
            .select('id')
            .single();
        
        if (deptError) {
            if (deptError.code === '23505') {
                 throw new Error(`O nome de departamento "${departmentData.name}" já está em uso.`);
            }
            throw deptError;
        }
        if (!savedDept) throw new Error("Falha ao salvar o departamento. Nenhum ID retornado.");
        
        // This function now correctly expects an array of leader IDs.
        const { error: leaderUpdateError } = await supabase.functions.invoke('update-department-leader', {
            body: {
                department_id: savedDept.id,
                leader_ids: leader_ids,
            },
        });

        if (leaderUpdateError) {
            // Even if leader update fails, the department was saved. We should show an informative error.
            throw new Error(`O departamento foi salvo, mas a atribuição de líderes falhou. Erro: ${getErrorMessage(leaderUpdateError)}`);
        }
        
        await fetchDepartments(); // Refetch all department data
        onLeadersChange(); // Trigger refetch of global leader list in App.tsx
        hideForm();

    } catch (error: any) {
        setSaveError(getErrorMessage(error));
        console.error("Error saving department:", error);
    } finally {
        setIsSaving(false);
    }
  };


  const renderContent = () => {
    if (loading) return <p className="text-center text-slate-500 mt-10">Carregando departamentos...</p>;
    if (error) return <p className="text-center text-red-500 mt-10">{error}</p>;
    return (
      <div className="space-y-6">
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                </div>
                <input 
                    type="text"
                    placeholder="Buscar por nome ou líder do departamento..."
                    className="w-full pl-10 pr-4 py-2 border-0 bg-transparent rounded-lg focus:ring-0 text-slate-900"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                />
            </div>
        </div>

        {paginatedDepartments.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {paginatedDepartments.map((department) => (
                <DepartmentCard 
                  key={department.id} 
                  department={department} 
                  onEdit={handleEditDepartment} 
                  onDelete={handleDeleteRequest} 
                  userRole={userRole}
                  isLeaderDepartment={department.id ? leaderDepartmentId === department.id : false}
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
            <h3 className="text-lg font-medium text-slate-800">Nenhum departamento encontrado</h3>
            <p className="mt-1 text-sm">Tente ajustar seus termos de busca ou adicione um novo departamento.</p>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Departamentos</h1>
          <p className="text-slate-500 mt-1">Gerencie os departamentos da igreja</p>
        </div>
        {userRole === 'admin' && (
          <button 
            onClick={() => { setEditingDepartment(null); showForm(); }}
            className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors shadow-sm w-full md:w-auto justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            <span>Novo Departamento</span>
          </button>
        )}
      </div>

      {isLeader && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
            <div className="flex">
                <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="ml-3">
                    <p className="text-sm text-blue-800">
                        Como líder, a visibilidade está restrita apenas ao seu departamento.
                    </p>
                </div>
            </div>
        </div>
      )}

      {isFormVisible ? (
        <NewDepartmentForm
          initialData={editingDepartment}
          onCancel={hideForm}
          onSave={handleSaveDepartment}
          isSaving={isSaving}
          saveError={saveError}
          leaders={leaders}
        />
      ) : (
        renderContent()
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este departamento? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default DepartmentsPage;