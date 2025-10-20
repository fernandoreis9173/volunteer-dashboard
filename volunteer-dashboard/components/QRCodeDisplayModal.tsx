import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: object | null;
  title: string;
  volunteerName?: string | null;
  description?: string;
  onConfirm?: () => void;
}

const QRCodeDisplayModal: React.FC<QRCodeDisplayModalProps> = ({ isOpen, onClose, data, title, volunteerName, description, onConfirm }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && data && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, JSON.stringify(data), { width: 256, errorCorrectionLevel: 'H' }, (error) => {
        if (error) console.error('Error generating QR Code:', error);
      });
    }
  }, [isOpen, data]);

  if (!isOpen) return null;

  return (
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
        
        <div className="my-6 p-4 bg-slate-50 rounded-lg inline-block">
          <canvas ref={canvasRef} />
        </div>

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
};

export default QRCodeDisplayModal;