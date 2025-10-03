



import React, { useState, useEffect, useCallback } from 'react';
import DepartmentCard from './DepartmentCard';
import NewDepartmentForm from './NewDepartmentForm';
import ConfirmationModal from './ConfirmationModal';
import { Department } from '../types';
import { SupabaseClient, User } from '@supabase/supabase-js';

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

interface DepartmentsPageProps {
  supabase: SupabaseClient | null;
  userRole: string | null;
}

const DepartmentsPage: React.FC<DepartmentsPageProps> = ({ supabase, userRole }) => {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [departmentToDeleteId, setDepartmentToDeleteId] = useState<number | null>(null);
  const [leaders, setLeaders] = useState<User[]>([]);
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const fetchDepartments = useCallback(async (query: string) => {
    if (!supabase) {
      setLoading(false);
      setError("Supabase client not initialized.");
      return;
    }
    setLoading(true);
    setError(null);
    
    let queryBuilder = supabase
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if(query) {
        queryBuilder = queryBuilder.or(`name.ilike.%${query}%,leader.ilike.%${query}%`);
    }

    const { data, error: fetchError } = await queryBuilder;

    if (fetchError) {
      console.error('Error fetching departments:', fetchError.message);
      setError("Não foi possível carregar os departamentos.");
      setDepartments([]);
    } else {
      setDepartments(data || []);
    }
    setLoading(false);
  }, [supabase]);

  const fetchLeaders = useCallback(async () => {
    if (!supabase) return;
    const { data, error: invokeError } = await supabase.functions.invoke('list-users');
    if (invokeError) {
        console.error('Error fetching leaders:', invokeError);
    } else if (data.users) {
        const potentialLeaders = data.users.filter((user: any) => {
            const role = user.user_metadata?.role;
            return (role === 'leader' || role === 'lider' || role === 'admin') && user.app_status === 'Ativo';
        });
        setLeaders(potentialLeaders);
    }
  }, [supabase]);

  useEffect(() => {
    fetchDepartments(debouncedSearchQuery);
  }, [debouncedSearchQuery, fetchDepartments]);

  useEffect(() => {
      fetchLeaders();
  }, [fetchLeaders]);

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
    if (!departmentToDeleteId || !supabase) return;

    const { error: deleteError } = await supabase.from('departments').delete().eq('id', departmentToDeleteId);

    if (deleteError) {
      alert(`Falha ao excluir departamento: ${deleteError.message}`);
    } else {
      setDepartments(departments.filter(m => m.id !== departmentToDeleteId));
    }
    handleCancelDelete();
  };
  
  const handleSaveDepartment = async (departmentData: Omit<Department, 'id' | 'created_at'> & { id?: number }, new_leader_id?: string) => {
    if (!supabase) {
      setSaveError("Conexão com o banco de dados não estabelecida.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);

    try {
        let savedDeptData;
        if (departmentData.id) { // Update
            const { data, error } = await supabase.from('departments').update(departmentData).eq('id', departmentData.id).select().single();
            if (error) throw error;
            savedDeptData = data;
        } else { // Insert
            const { id, ...insertData } = departmentData; // eslint-disable-line @typescript-eslint/no-unused-vars
            const { data, error } = await supabase.from('departments').insert(insertData).select().single();
            if (error) throw error;
            savedDeptData = data;
        }
        
        if (!savedDeptData) throw new Error("Falha ao obter os dados do departamento salvo.");
        
        const departmentId = savedDeptData.id;

        if (new_leader_id) {
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ department_id: departmentId })
                .eq('id', new_leader_id);
            
            if (profileError) {
                // This is a partial success, the department was saved but leader link failed.
                // We should still update the UI and maybe show a different message.
                console.error(`Departamento salvo, mas falha ao vincular o líder: ${profileError.message}`);
            }
        }
        
        if (departmentData.id) {
            setDepartments(departments.map(d => d.id === savedDeptData.id ? savedDeptData : d));
        } else {
            setDepartments([savedDeptData, ...departments].sort((a,b) => a.name.localeCompare(b.name)));
        }

        hideForm();
    } catch (error: any) {
        const errorMessage = error.message || "A operação falhou.";
        setSaveError(`Falha ao salvar: ${errorMessage}`);
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
                    <svg xmlns="http://www.w.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                </div>
                <input 
                    type="text"
                    placeholder="Buscar por nome ou líder do departamento..."
                    className="w-full pl-10 pr-4 py-2 border-0 bg-transparent rounded-lg focus:ring-0 text-slate-900"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        </div>

        {departments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {departments.map((department) => (
              <DepartmentCard key={department.id} department={department} onEdit={handleEditDepartment} onDelete={handleDeleteRequest} userRole={userRole} />
            ))}
          </div>
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
            className="bg-teal-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-teal-600 transition-colors shadow-sm w-full md:w-auto justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            <span>Novo Departamento</span>
          </button>
        )}
      </div>

      {isFormVisible ? (
        <NewDepartmentForm
          supabase={supabase}
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