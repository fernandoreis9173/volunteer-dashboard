import React from 'react';
import ReactDOM from 'react-dom';

interface IOSInstallPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const IOSInstallPromptModal: React.FC<IOSInstallPromptModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end justify-center p-4 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md p-6 m-4 text-center transform transition-all duration-300 translate-y-full opacity-0 animate-slide-up-fade"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <h3 id="ios-install-title" className="text-xl font-bold text-slate-900">Instalar o Aplicativo</h3>
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          <p>Para adicionar este aplicativo à sua Tela de Início, siga estes passos:</p>
          <ol className="text-left list-decimal list-inside space-y-2 bg-slate-50 p-4 rounded-lg">
            <li>Toque no ícone de <strong>Compartilhar</strong>
              <svg xmlns="http://www.w3.org/2000/svg" className="inline-block h-5 w-5 align-middle mx-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                <polyline points="16 6 12 2 8 6"></polyline>
                <line x1="12" y1="2" x2="12" y2="15"></line>
              </svg>
              na barra de navegação do seu navegador.
            </li>
            <li>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.</li>
            <li>Toque em <strong>"Adicionar"</strong> no canto superior direito para confirmar.</li>
          </ol>
        </div>
        <div className="mt-6">
          <button
            type="button"
            className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-blue-600 text-base font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto"
            onClick={onClose}
          >
            Entendi
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slide-up-fade {
          from { opacity: 0; transform: translateY(100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up-fade {
          animation: slide-up-fade 0.3s ease-out forwards;
        }
        @media (min-width: 640px) {
            @keyframes fade-in-scale {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
            .animate-slide-up-fade {
                animation-name: fade-in-scale;
                transform: translateY(0);
            }
        }
      `}</style>
    </div>
  );
  
  return ReactDOM.createPortal(modalContent, document.body);
};

export default IOSInstallPromptModal;
