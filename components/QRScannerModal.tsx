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

  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string | undefined>(undefined);
  const [cameraError, setCameraError] = React.useState<string | null>(null);

  // Ref para controlar a inicialização
  const initializationIdRef = useRef(0);
  // Ref para guardar o stream atual e poder parar as tracks
  const streamRef = useRef<MediaStream | null>(null);

  // Função para detectar mobile
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // Carrega dispositivos
  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setVideoDevices(cameras);
    } catch (e) {
      console.error("Erro ao listar dispositivos:", e);
    }
  };

  // Efeito principal de controle do scanner
  useEffect(() => {
    const currentInitId = ++initializationIdRef.current;

    const stopScanner = () => {
      // Para o Zxing
      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch (e) { }
        controlsRef.current = null;
      }
      // Para o stream de vídeo (solta a câmera)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      isStartingRef.current = false;
    };

    if (!isOpen || scanResult) {
      stopScanner();
      return;
    }

    // Para qualquer execução anterior antes de iniciar a nova
    stopScanner();

    isStartingRef.current = true;
    setCameraError(null);

    const startCameraAndScanner = async () => {
      if (currentInitId !== initializationIdRef.current) return;
      if (!videoRef.current) return;

      const codeReader = new BrowserQRCodeReader();

      try {
        // 1. Configurar Constraints
        let constraints: MediaStreamConstraints = {
          video: {
            facingMode: isMobile() ? 'environment' : 'user'
          }
        };

        if (selectedDeviceId) {
          constraints = { video: { deviceId: { exact: selectedDeviceId } } };
        }

        // 2. Obter Stream Manualmente (Controle Total)
        console.log(`[Scanner] Solicitando stream com:`, constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (currentInitId !== initializationIdRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        // 3. Iniciar Zxing com o Stream (Zxing gerencia o vídeo)
        // Não precisamos dar play manual ou setar srcObject, o decodeFromStream faz isso.

        // Pequeno delay para garantir renderização
        await new Promise(r => setTimeout(r, 100));

        if (currentInitId !== initializationIdRef.current) return;

        const controls = await codeReader.decodeFromStream(
          stream,
          videoRef.current!,
          (result) => {
            if (result && currentInitId === initializationIdRef.current) {
              stopScanner();
              onScanSuccess(result.getText());
            }
          }
        );

        if (currentInitId === initializationIdRef.current) {
          controlsRef.current = controls;
          loadDevices(); // Carrega lista para o dropdown
        } else {
          controls.stop();
        }

      } catch (error: any) {
        if (currentInitId !== initializationIdRef.current) return;
        console.error('Erro ao iniciar câmera/scanner:', error);
        console.error('Nome do erro:', error.name);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);

        if (error.name === 'AbortError') return;

        let msg = `Erro: ${error.name} - ${error.message}`;
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          msg = "Permissão de câmera negada.";
        } else if (error.name === 'NotFoundError') {
          msg = "Nenhuma câmera encontrada.";
        } else if (error.name === 'NotReadableError') {
          msg = "A câmera está em uso ou indisponível.";
        } else if (error.name === 'OverconstrainedError') {
          // Fallback: Tenta sem constraints (padrãozão)
          if (!selectedDeviceId) {
            console.log("Fallback para constraints padrão...");
            try {
              const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
              if (currentInitId === initializationIdRef.current) {
                streamRef.current = fallbackStream;

                // Reinicia Zxing com decodeFromStream
                const fallbackControls = await codeReader.decodeFromStream(
                  fallbackStream,
                  videoRef.current!,
                  (result) => {
                    if (result && currentInitId === initializationIdRef.current) {
                      stopScanner();
                      onScanSuccess(result.getText());
                    }
                  }
                );
                controlsRef.current = fallbackControls;
                loadDevices();
                return;
              } else {
                fallbackStream.getTracks().forEach(t => t.stop());
              }
            } catch (e) {
              console.error("Fallback falhou", e);
            }
          }
          msg = "Câmera incompatível.";
        }
        setCameraError(msg);
      } finally {
        if (currentInitId === initializationIdRef.current) {
          isStartingRef.current = false;
        }
      }
    };

    startCameraAndScanner();

    return () => {
      stopScanner();
    };
  }, [isOpen, onScanSuccess, scanResult, selectedDeviceId]);

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
              <p className="text-xs opacity-80 mb-2">{scanningEventName}</p>

              {/* Seletor de Câmera - Só mostra se tivermos dispositivos listados */}
              {videoDevices.length > 1 && (
                <div className="relative inline-block text-left">
                  <select
                    value={selectedDeviceId || ''}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="bg-white/20 text-white text-xs rounded px-2 py-1 border border-white/30 focus:outline-none focus:border-white appearance-none pr-6 cursor-pointer backdrop-blur-sm hover:bg-white/30 transition-colors"
                  >
                    <option value="">Automático</option>
                    {videoDevices.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId} className="text-black">
                        {device.label || `Câmera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-white">
                    <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                  </div>
                </div>
              )}
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

          {/* Erro de Câmera */}
          {cameraError && !scanResult && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 text-center bg-black/80 backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-white text-lg font-medium">{cameraError}</p>
              <button
                onClick={() => { setCameraError(null); setSelectedDeviceId(undefined); }}
                className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors pointer-events-auto"
              >
                Tentar Novamente
              </button>
            </div>
          )}

          {/* Scanner Overlay (Mira) */}
          {!scanResult && !cameraError && (
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