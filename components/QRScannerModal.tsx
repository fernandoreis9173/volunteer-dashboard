import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';

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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);

  useEffect(() => {
    const stopScanner = async () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        try {
          await scannerRef.current.stop();
        } catch (e) {
          console.error('Erro ao parar scanner:', e);
        }
      }
      isStartingRef.current = false;
    };

    if (!isOpen || scanResult) {
      stopScanner();
      return;
    }

    if (isStartingRef.current) {
      return;
    }

    isStartingRef.current = true;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };

        // Tenta iniciar com a primeira câmera disponível
        await scanner.start(
          { facingMode: "environment" }, // Tenta câmera traseira primeiro
          config,
          (decodedText) => {
            stopScanner();
            onScanSuccess(decodedText);
          },
          (errorMessage) => {
            // Ignora erros de scan (normal quando não há QR code)
          }
        ).catch(async (err) => {
          console.log('[Scanner] Falhou com environment, tentando com user...', err);
          // Se falhar, tenta com câmera frontal
          try {
            await scanner.start(
              { facingMode: "user" },
              config,
              (decodedText) => {
                stopScanner();
                onScanSuccess(decodedText);
              },
              (errorMessage) => {
                // Ignora erros de scan
              }
            );
          } catch (userErr) {
            console.log('[Scanner] Falhou com user, tentando com deviceId...', userErr);
            // Se ainda falhar, tenta com a primeira câmera disponível
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              await scanner.start(
                devices[0].id,
                config,
                (decodedText) => {
                  stopScanner();
                  onScanSuccess(decodedText);
                },
                (errorMessage) => {
                  // Ignora erros de scan
                }
              );
            }
          }
        });

        console.log('[Scanner] Scanner iniciado com sucesso!');
      } catch (error) {
        console.error('Erro ao iniciar scanner:', error);
        isStartingRef.current = false;
      }
    };

    const timer = setTimeout(startScanner, 300);

    return () => {
      clearTimeout(timer);
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

        {/* Scanner Area */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          <div id="qr-reader" className="w-full h-full"></div>

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
        #qr-reader {
          width: 100% !important;
        }
        #qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        #qr-reader__dashboard {
          display: none !important;
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