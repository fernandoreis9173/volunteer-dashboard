import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import QRCode from 'qrcode';

interface QRCodeDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: object | null;
  title: string;
  volunteerName?: string | null;
  description?: string;
  onConfirm?: () => void;
  attendanceConfirmed?: boolean; // Nova prop
}

const QRCodeDisplayModal: React.FC<QRCodeDisplayModalProps> = ({ isOpen, onClose, data, title, volunteerName, description, onConfirm, attendanceConfirmed }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && data && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, JSON.stringify(data), { width: 256, errorCorrectionLevel: 'H' }, (error) => {
        if (error) console.error('Error generating QR Code:', error);
      });
    }
  }, [isOpen, data]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 transition-opacity duration-300"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 m-4 text-center transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="modal-title" className="text-xl font-bold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{description || 'Apresente este código para o líder do seu departamento.'}</p>

        {attendanceConfirmed ? (
          <div className="my-6 p-8 bg-green-50 border-2 border-green-200 rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div className="text-center">
                <p className="text-lg font-bold text-green-700">Presença Confirmada!</p>
                <p className="text-sm text-green-600 mt-1">Sua presença já foi registrada</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="my-6 p-4 bg-slate-50 rounded-lg inline-block">
            <canvas ref={canvasRef} />
          </div>
        )}

        {volunteerName && <p className="font-semibold text-slate-800">{volunteerName}</p>}

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-center gap-3">
          <button
            type="button"
            className="w-full inline-flex justify-center rounded-lg border border-slate-300 px-4 py-2 bg-white text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto"
            onClick={onClose}
          >
            {onConfirm ? 'Cancelar' : 'Fechar'}
          </button>
          {onConfirm && (
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-green-600 text-base font-semibold text-white shadow-sm hover:bg-green-700 sm:w-auto"
              onClick={onConfirm}
            >
              Confirmar Presença
            </button>
          )}
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

export default QRCodeDisplayModal;
