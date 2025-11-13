import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { DetailedVolunteer, Department } from '../types';

interface PromoteToLeaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (departmentId: number) => void;
  volunteer: DetailedVolunteer | null;
  departments: Department[];
  isPromoting: boolean;
  error: string | null;
}

const PromoteToLeaderModal: React.FC<PromoteToLeaderModalProps> = ({ isOpen, onClose, onConfirm, volunteer, departments, isPromoting, error }) => {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');

  useEffect(() => {
    if (!isOpen) {
      setSelectedDepartmentId(''); // Reset on open/close
    }
  }, [isOpen]);

  if (!isOpen || !volunteer) return null;

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
        <h3 id="modal-title" className="text-xl font-bold text-slate-900">Promover a Líder</h3>
        <p className="text-sm text-slate-500 mt-1">
          Você está prestes a promover <strong>{volunteer.name}</strong> a líder.
        </p>

        <div className="mt-4 text-sm bg-slate-50 p-3 rounded-lg border border-slate-200">
            <p><strong>Atenção:</strong> Esta ação irá alterar a permissão do usuário para 'líder', e seu registro de voluntário será desativado. Ele perderá o acesso às suas telas de voluntário.</p>
        </div>

        <div className="mt-4">
            <label htmlFor="department" className="block text-sm font-medium text-slate-700 mb-1">
                Selecione o Departamento para Liderar
            </label>
            <select
                id="department"
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm"
            >
                <option value="" disabled>Selecione um departamento...</option>
                {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                        {dept.name}
                    </option>
                ))}
            </select>
        </div>
        
        {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
        
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
                type="button"
                className="w-full inline-flex justify-center rounded-lg border border-slate-300 px-4 py-2 bg-white text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto disabled:opacity-50"
                onClick={onClose}
                disabled={isPromoting}
            >
                Cancelar
            </button>
            <button
                type="button"
                className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-blue-600 text-base font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto disabled:bg-blue-400"
                onClick={handleConfirm}
                disabled={!selectedDepartmentId || isPromoting}
            >
                {isPromoting ? 'Promovendo...' : 'Confirmar Promoção'}
            </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default PromoteToLeaderModal;
