import React, { useState } from 'react';
import { DashboardEvent } from '../types';

interface RequestSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  event: DashboardEvent | null;
  isSubmitting: boolean;
}

const RequestSwapModal: React.FC<RequestSwapModalProps> = ({ isOpen, onClose, onSubmit, event, isSubmitting }) => {
  const [reason, setReason] = useState('');

  if (!isOpen || !event) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(reason);
  };

  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 transition-opacity duration-300"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 m-4 text-left transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale">
        <h3 id="modal-title" className="text-xl font-bold text-slate-900">Solicitar Troca de Escala</h3>
        <p className="text-sm text-slate-500 mt-1">
          Sua solicitação será enviada ao líder do seu departamento para encontrar um substituto.
        </p>

        <div className="my-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="font-semibold text-slate-800">{event.name}</p>
            <p className="text-sm text-slate-600">{new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <p className="text-sm text-slate-600">{event.start_time.substring(0,5)} - {event.end_time.substring(0,5)}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-slate-700 mb-1">
              Motivo da troca (opcional)
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Ex: Tive um imprevisto e não poderei comparecer..."
            />
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-lg border border-slate-300 px-4 py-2 bg-white text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto disabled:opacity-50"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-blue-600 text-base font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto disabled:bg-blue-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Solicitação'}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        @keyframes fade-in-scale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-scale {
          animation: fade-in-scale 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default RequestSwapModal;