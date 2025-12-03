import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Department } from '../types';

import { supabase } from '../lib/supabaseClient';

interface DemoteToVolunteerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (departmentIds: number[]) => void;
    user: { id: string; name: string; email: string } | null;
    departments: Department[];
    isDemoting: boolean;
    error: string | null;
}

const DemoteToVolunteerModal: React.FC<DemoteToVolunteerModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    user,
    departments,
    isDemoting,
    error
}) => {
    const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setSelectedDepartmentIds([]); // Reset on close
            setSearchQuery(''); // Reset search
        } else if (user) {
            // Tentar buscar departamentos anteriores do voluntário
            const fetchPreviousDepartments = async () => {
                try {
                    // 1. Buscar ID do voluntário pelo user_id
                    const { data: volunteerData } = await supabase
                        .from('volunteers')
                        .select('id')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    if (volunteerData) {
                        // 2. Buscar departamentos vinculados
                        const { data: deptData } = await supabase
                            .from('volunteer_departments')
                            .select('department_id')
                            .eq('volunteer_id', volunteerData.id);

                        if (deptData && deptData.length > 0) {
                            const prevDeptIds = deptData.map(d => d.department_id);
                            console.log('Departamentos anteriores encontrados:', prevDeptIds);
                            setSelectedDepartmentIds(prevDeptIds);
                        }
                    }
                } catch (err) {
                    console.error('Erro ao buscar departamentos anteriores:', err);
                }
            };
            fetchPreviousDepartments();
        }
    }, [isOpen, user]);

    if (!isOpen || !user) return null;

    const handleDepartmentToggle = (deptId: number) => {
        setSelectedDepartmentIds(prev =>
            prev.includes(deptId)
                ? prev.filter(id => id !== deptId)
                : [...prev, deptId]
        );
    };

    const handleConfirm = () => {
        if (selectedDepartmentIds.length > 0) {
            onConfirm(selectedDepartmentIds);
        }
    };

    // Filter departments based on search query
    const filteredDepartments = departments.filter(dept =>
        dept.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const modalContent = (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 m-4 text-left max-h-[90vh] overflow-y-auto">
                <h3 id="modal-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">Tornar Voluntário</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Você está prestes a rebaixar <strong>{user.name}</strong> de líder para voluntário.
                </p>

                <div className="mt-4 text-sm bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                    <p><strong>Atenção:</strong> Esta ação irá alterar a permissão do usuário para 'volunteer', e ele perderá o acesso às telas de líder. Um registro de voluntário será criado automaticamente.</p>
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Selecione os Departamentos (pelo menos 1)
                    </label>

                    {/* Search Input */}
                    <div className="relative mb-3">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar departamento..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Departments List */}
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                        {filteredDepartments.length > 0 ? (
                            filteredDepartments.map(dept => (
                                <label
                                    key={dept.id}
                                    className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 p-2 rounded"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedDepartmentIds.includes(dept.id)}
                                        onChange={() => handleDepartmentToggle(dept.id)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">{dept.name}</span>
                                </label>
                            ))
                        ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                                Nenhum departamento encontrado
                            </p>
                        )}
                    </div>
                    {selectedDepartmentIds.length > 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            {selectedDepartmentIds.length} departamento(s) selecionado(s)
                        </p>
                    )}
                </div>

                {error && <p className="text-sm text-red-500 mt-4">{error}</p>}

                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 bg-white dark:bg-slate-700 text-base font-semibold text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 sm:w-auto disabled:opacity-50"
                        onClick={onClose}
                        disabled={isDemoting}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-blue-600 text-base font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto disabled:bg-blue-400"
                        onClick={handleConfirm}
                        disabled={selectedDepartmentIds.length === 0 || isDemoting}
                    >
                        {isDemoting ? 'Processando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default DemoteToVolunteerModal;
