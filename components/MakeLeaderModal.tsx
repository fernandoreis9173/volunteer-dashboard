import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { User, Department } from '../types';
import CustomSelect from './CustomSelect';

interface MakeLeaderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (departmentId: number) => void;
    user: User | null;
    departments: Department[];
    isProcessing: boolean;
    error: string | null;
}

const MakeLeaderModal: React.FC<MakeLeaderModalProps> = ({ isOpen, onClose, onConfirm, user, departments, isProcessing, error }) => {
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');

    useEffect(() => {
        if (!isOpen) {
            setSelectedDepartmentId('');
        }
    }, [isOpen]);

    if (!isOpen || !user) return null;

    const handleConfirm = () => {
        if (selectedDepartmentId) {
            onConfirm(parseInt(selectedDepartmentId, 10));
        }
    };

    const modalContent = (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4 text-left">
                <h3 id="modal-title" className="text-xl font-bold text-slate-900">Tornar Líder</h3>
                <p className="text-sm text-slate-500 mt-1">
                    Você está prestes a tornar <strong>{user.user_metadata?.name || user.email}</strong> um líder.
                </p>

                <div className="mt-4 text-sm bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p><strong>Atenção:</strong> O usuário terá permissões de líder e será responsável pelo departamento selecionado.</p>
                </div>

                <div className="mt-4">
                    <CustomSelect
                        label="Selecione o Departamento"
                        options={departments.map(dept => ({ value: dept.id, label: dept.name }))}
                        value={selectedDepartmentId ? parseInt(selectedDepartmentId) : null}
                        onChange={(val) => setSelectedDepartmentId(val.toString())}
                        placeholder="Selecione um departamento..."
                        disabled={isProcessing}
                    />
                </div>

                {error && <p className="text-sm text-red-500 mt-4">{error}</p>}

                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-lg border border-slate-300 px-4 py-2 bg-white text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto disabled:opacity-50"
                        onClick={onClose}
                        disabled={isProcessing}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-blue-600 text-base font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto disabled:bg-blue-400"
                        onClick={handleConfirm}
                        disabled={!selectedDepartmentId || isProcessing}
                    >
                        {isProcessing ? 'Processando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default MakeLeaderModal;
