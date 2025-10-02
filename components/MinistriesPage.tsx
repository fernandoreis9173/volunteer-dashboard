
import React, { useState, useEffect } from 'react';
import MinistryCard from './MinistryCard';
import NewMinistryForm from './NewMinistryForm';
import ConfirmationModal from './ConfirmationModal';
import { Department } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

interface MinistriesPageProps {
  supabase: SupabaseClient | null;
  userRole: string | null;
}

const MinistriesPage: React.FC<MinistriesPageProps> = ({ supabase, userRole }) => {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [ministryToDeleteId, setMinistryToDeleteId] = useState<number | null>(null);

  const fetchDepartments = async () => {
    if (!supabase) {
      setLoading(false);
      setError("Supabase client not initialized.");
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (fetchError) {
      console.error('Error fetching departments:', fetchError.message);
      setError("Não foi possível carregar os departamentos.");
      setDepartments([]);
    } else {
      setDepartments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDepartments();
  }, [supabase]);

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
    setMinistryToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setMinistryToDeleteId(null);
  };

  const handleConfirmDelete = async () => {
    if (!ministryToDeleteId || !supabase) return;

    const { error: deleteError } = await supabase.from('departments').delete().eq('id', ministryToDeleteId);

    if (deleteError) {
      alert(`Falha ao excluir departamento: ${deleteError.message}`);
    } else {
      setDepartments(departments.filter(m => m.id !== ministryToDeleteId));
    }
    handleCancelDelete();
  };
  
  const handleSaveDepartment = async (departmentData: Omit<Department, 'created_at'>) => {
    if (!supabase) {
      setSaveError("Conexão com o banco de dados não estabelecida.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    
    let error;
    let data;

    if (departmentData.id) { // Update
        const { id, ...updateData } = departmentData;
        const { data: updateDataResult, error: updateError } = await supabase
            .from('departments')
            .update(updateData)
            .eq('id', id)
            .select();
        data = updateDataResult;
        error = updateError;
    } else { // Insert
        const { id, ...insertData } = departmentData;
        const { data: insertDataResult, error: insertError } = await supabase
            .from('departments')
            .insert([insertData])
            .select();
        data = insertDataResult;
        error = insertError;
    }

    if (error || !data || data.length === 0) {
        const errorMessage = error ? error.message : "A operação falhou. Verifique suas permissões ou os dados inseridos.";
        setSaveError(`Falha ao salvar: ${errorMessage}`);
        console.error("Error saving department:", error);
    } else {
        await fetchDepartments();
        hideForm();
    }
    setIsSaving(false);
  };

  const filteredDepartments = departments.filter(department => {
    const query = searchQuery.toLowerCase();
    if (!query) return true;
    const nameMatch = department.name.toLowerCase().includes(query);
    const leaderMatch = department.leader.toLowerCase().includes(query);
    return nameMatch || leaderMatch;
  });

  const renderContent = () => {
    if (loading) return <p className="text-center text-slate-500 mt-10">Carregando departamentos...</p>;
    if (error) return <p className="text-center text-red-500 mt-10">{error}</p>;
    return (
      <div className="space-y-6">
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
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

        {filteredDepartments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredDepartments.map((department) => (
              <MinistryCard key={department.id} ministry={department} onEdit={handleEditDepartment} onDelete={handleDeleteRequest} userRole={userRole} />
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
            className="bg-orange-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-orange-600 transition-colors shadow-sm w-full md:w-auto justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            <span>Novo Departamento</span>
          </button>
        )}
      </div>

      {isFormVisible ? (
        <NewMinistryForm 
            supabase={supabase}
            initialData={editingDepartment}
            onCancel={hideForm} 
            onSave={handleSaveDepartment}
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
        message="Tem certeza que deseja excluir este departamento? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default MinistriesPage;
