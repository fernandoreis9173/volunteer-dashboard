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
  const hasProcessedScanRef = useRef(false);

  // Detecta se é mobile
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  useEffect(() => {
    const stopScanner = async () => {
      console.log('[Scanner] Parando scanner...');
      if (scannerRef.current && scannerRef.current.isScanning) {
        try {
          await scannerRef.current.stop();
          console.log('[Scanner] Scanner parado com sucesso');
        } catch (e) {
          console.error('[Scanner] Erro ao parar scanner:', e);
        }
      }
      isStartingRef.current = false;
    };

    if (!isOpen || scanResult) {
      console.log('[Scanner] Modal fechado ou resultado presente, parando scanner');
      stopScanner();
      return;
    }

    if (isStartingRef.current) {
      console.log('[Scanner] Scanner já está iniciando, ignorando');
      return;
    }

    // Reset da flag quando o modal abre
    hasProcessedScanRef.current = false;
    isStartingRef.current = true;

    const startScanner = async () => {
      try {
        console.log('[Scanner] Iniciando scanner...');
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        const mobile = isMobile();
        console.log('[Scanner] Dispositivo mobile:', mobile);

        // Configuração sem forçar resolução - usa configuração nativa da câmera
        const config = {
          fps: 30,
          qrbox: { width: 300, height: 300 },
          disableFlip: false
        };

        const facingMode = mobile ? "environment" : "user";
        console.log('[Scanner] Usando facingMode:', facingMode);

        // Callback de sucesso
        const onScanSuccessCallback = async (decodedText: string) => {
          // Previne múltiplas chamadas
          if (hasProcessedScanRef.current) {
            console.log('[Scanner] QR code já processado, ignorando');
            return;
          }

          hasProcessedScanRef.current = true;
          console.log('[Scanner] ✅ QR Code detectado:', decodedText);

          // Chama o callback ANTES de parar o scanner
          console.log('[Scanner] Chamando onScanSuccess...');
          onScanSuccess(decodedText);

          // Aguarda um pouco antes de parar o scanner para garantir que o callback foi processado
          setTimeout(async () => {
            await stopScanner();
          }, 100);
        };

        // Tenta iniciar com facingMode apropriado
        await scanner.start(
          { facingMode },
          config,
          onScanSuccessCallback,
          (errorMessage) => {
            // Ignora erros de scan (normal quando não há QR code)
          }
        ).catch(async (err) => {
          console.log(`[Scanner] ⚠️ Falhou com ${facingMode}, tentando fallback...`, err);

          // Fallback: tenta com a primeira câmera disponível
          try {
            const devices = await Html5Qrcode.getCameras();
            console.log('[Scanner] Câmeras disponíveis:', devices.length);
            if (devices && devices.length > 0) {
              console.log('[Scanner] Usando câmera:', devices[0].label || devices[0].id);
              await scanner.start(
                devices[0].id,
                config,
                onScanSuccessCallback,
                (errorMessage) => {
                  // Ignora erros de scan
                }
              );
            }
          } catch (fallbackErr) {
            console.error('[Scanner] ❌ Fallback falhou:', fallbackErr);
          }
        });

        console.log('[Scanner] ✅ Scanner iniciado com sucesso!');
      } catch (error) {
        console.error('[Scanner] ❌ Erro ao iniciar scanner:', error);
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
      className="fixed inset-0 bg-black z-50 flex items-center justify-center"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full h-full flex flex-col">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-black/80 to-transparent text-white">
          <div className="flex justify-between items-start">
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

        {/* Scanner Area - Tela Cheia */}
        <div className="flex-1 relative bg-black overflow-hidden">
          <div id="qr-reader" className="absolute inset-0"></div>

          {/* Overlay de Scan Animado */}
          {!scanResult && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
              {/* Área de foco do QR Code */}
              <div className="relative w-72 h-72">
                {/* Cantos animados */}
                <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl animate-pulse-corner"></div>
                <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl animate-pulse-corner"></div>
                <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl animate-pulse-corner"></div>
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-blue-500 rounded-br-2xl animate-pulse-corner"></div>

                {/* Linha de scan animada */}
                <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_20px_rgba(59,130,246,0.8)] animate-scan-line"></div>

                {/* Brilho de fundo */}
                <div className="absolute inset-0 bg-blue-500/5 rounded-2xl"></div>
              </div>

              {/* Instrução */}
              <div className="absolute bottom-32 left-0 right-0 flex justify-center">
                <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/20">
                  <p className="text-white text-sm font-medium">Aponte para o QR Code</p>
                </div>
              </div>
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
        /* Esconde completamente a UI do html5-qrcode */
        #qr-reader {
          width: 100% !important;
          height: 100% !important;
        }
        
        /* Mobile: vídeo vertical em tela cheia */
        @media (max-width: 768px) {
          #qr-reader video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            border: none !important;
          }
        }
        
        /* Desktop: vídeo horizontal sem cortar */
        @media (min-width: 769px) {
          #qr-reader video {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
            border: none !important;
          }
        }
        
        #qr-reader__dashboard,
        #qr-reader__dashboard_section,
        #qr-reader__dashboard_section_csr,
        #qr-reader__header_message,
        #qr-reader__camera_selection,
        #qr-reader__scan_region {
          display: none !important;
        }
        
        /* Animação da linha de scan */
        @keyframes scan-line {
          0% { 
            top: 0%; 
            opacity: 0;
          }
          10% { 
            opacity: 1;
          }
          90% { 
            opacity: 1;
          }
          100% { 
            top: 100%; 
            opacity: 0;
          }
        }
        .animate-scan-line {
          animation: scan-line 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        
        /* Animação dos cantos */
        @keyframes pulse-corner {
          0%, 100% { 
            opacity: 1;
            filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.8));
          }
          50% { 
            opacity: 0.6;
            filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.4));
          }
        }
        .animate-pulse-corner {
          animation: pulse-corner 2s ease-in-out infinite;
        }
        
        /* Animações de feedback */
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