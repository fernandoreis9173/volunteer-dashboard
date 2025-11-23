import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { BrowserQRCodeReader } from '@zxing/browser';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  scanningEventName?: string | null;
  scanResult?: { type: 'success' | 'error'; message: string } | null;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  scanningEventName,
  scanResult
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<any>(null);
  const isStartingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Função para detectar se é mobile
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // Efeito para controlar o scanner
  useEffect(() => {
    // Função para parar o scanner
    const stopScanner = () => {
      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch (e) { }
        controlsRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isStartingRef.current = false;
    };

    // Se modal fechado ou mostrando resultado, para o scanner
    if (!isOpen || scanResult) {
      stopScanner();
      return;
    }

    // Se já está iniciando ou rodando, não faz nada
    if (isStartingRef.current || controlsRef.current) {
      return;
    }

    isStartingRef.current = true;

    timeoutRef.current = setTimeout(async () => {
      if (!videoRef.current) return;

      const codeReader = new BrowserQRCodeReader();
      const mobile = isMobile();

      try {
        // Configuração diferente para mobile vs desktop
        const constraints = mobile ? {
          video: {
            facingMode: 'environment', // Câmera traseira para mobile
            width: { ideal: 720 },
            height: { ideal: 1280 }
          }
        } : {
          video: {
            facingMode: 'user', // Câmera frontal para desktop
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

        // Pede permissão primeiro
        await navigator.mediaDevices.getUserMedia(constraints).then(stream => {
          stream.getTracks().forEach(track => track.stop());
        });

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        let selectedDeviceId = videoDevices[0]?.deviceId;

        if (mobile) {
          // Para mobile, procura câmera traseira
          const backCamera = videoDevices.find(device => {
            const label = device.label.toLowerCase();
            return (
              label.includes('back') ||
              label.includes('rear') ||
              label.includes('traseira') ||
              label.includes('environment')
            );
          });
          if (backCamera) {
            selectedDeviceId = backCamera.deviceId;
          }
        }
        // Para desktop, usa a primeira câmera (geralmente a webcam integrada)

        const controls = await codeReader.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          (result) => {
            if (result) {
              stopScanner();
              onScanSuccess(result.getText());
            }
          }
        );

        controlsRef.current = controls;
      } catch (error) {
        console.error('Erro ao iniciar scanner:', error);
        isStartingRef.current = false;
      }
    }, 300);

    return () => {
      stopScanner();
    };
  }, [isOpen, onScanSuccess, scanResult]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-0 md:p-4 transition-opacity duration-300"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-black relative w-full h-full md:h-auto md:max-w-md md:rounded-2xl md:overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 to-transparent text-white pointer-events-none">
          <div className="flex justify-between items-start pointer-events-auto">
            <div className="flex-1 mr-4">
              <h3 className="text-lg font-bold leading-tight">Escanear Presença</h3>
              <p className="text-xs opacity-80">{scanningEventName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/10 rounded-full backdrop-blur-sm hover:bg-white/20 transition-colors flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Video Area */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />

          {/* Scanner Overlay (Mira) */}
          {!scanResult && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-white/30 rounded-lg relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1 rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1 rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1 rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1 rounded-br-lg"></div>
                <div className="absolute left-0 right-0 h-0.5 bg-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan-line top-1/2"></div>
              </div>
              <p className="absolute bottom-20 text-white/80 text-sm font-medium bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                Aponte para o QR Code
              </p>
            </div>
          )}

          {/* Feedback Overlay */}
          {scanResult && (
            <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center animate-fade-in ${scanResult.type === 'success' ? 'bg-green-600/90' : 'bg-red-600/90'
              } backdrop-blur-sm`}>
              <div className="bg-white rounded-full p-4 mb-4 shadow-lg animate-bounce-in">
                {scanResult.type === 'success' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                {scanResult.type === 'success' ? 'Confirmado!' : 'Erro!'}
              </h3>
              <p className="text-white/90 text-lg font-medium max-w-xs">
                {scanResult.message}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scan-line {
          0% { transform: translateY(-120px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(120px); opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes bounce-in {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default QRScannerModal;