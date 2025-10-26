import React from 'react';
import ReactDOM from 'react-dom';

interface PushNotificationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const PushNotificationModal: React.FC<PushNotificationModalProps> = ({ isOpen, onConfirm, onClose }) => {
  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 transition-opacity duration-300"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4 text-center transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
        </div>
        <h3 id="modal-title" className="text-xl font-bold text-slate-900">Fique por dentro!</h3>
        <div className="mt-2">
            <p className="text-sm text-slate-500">
                Ative as notificações para receber alertas sobre novas escalas e atualizações importantes dos eventos.
            </p>
        </div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-center gap-3">
            <button
                type="button"
                className="w-full inline-flex justify-center rounded-lg border border-slate-300 px-4 py-2 bg-white text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto"
                onClick={onClose}
            >
                Agora não
            </button>
            <button
                type="button"
                className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-blue-600 text-base font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto"
                onClick={onConfirm}
            >
                Ativar Notificações
            </button>
        </div>
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

  return ReactDOM.createPortal(modalContent, document.body);
};

export default PushNotificationModal;
