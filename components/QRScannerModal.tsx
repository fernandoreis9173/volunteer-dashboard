import React, { useEffect, useRef, useState } from 'react';
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
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função helper para adicionar logs
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setDebugLogs(prev => [...prev.slice(-10), logMessage]); // Mantém apenas os últimos 10 logs
  };

  // Detecta se é mobile
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // Detecta se está em iOS PWA
  const isIOSPWA = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    return isIOS && isPWA;
  };

  // Handler para upload de imagem
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      addDebugLog('📸 Processando imagem...');
      const scanner = new Html5Qrcode('qr-reader-file');
      const result = await scanner.scanFile(file, false);
      addDebugLog('✅ QR detectado na imagem!');
      onScanSuccess(result);
    } catch (err) {
      addDebugLog('❌ Erro ao ler imagem: ' + err);
      setScannerError('Não foi possível ler o QR code da imagem. Tente novamente.');
    }
  };

  useEffect(() => {
    const stopScanner = async () => {
      addDebugLog('Parando scanner...');
      if (scannerRef.current && scannerRef.current.isScanning) {
        try {
          await scannerRef.current.stop();
          addDebugLog('✅ Scanner parado');
        } catch (e) {
          addDebugLog('❌ Erro ao parar: ' + e);
        }
      }
      isStartingRef.current = false;
    };

    if (!isOpen || scanResult) {
      addDebugLog('Modal fechado, parando');
      stopScanner();
      return;
    }

    // Se for iOS PWA, não tenta iniciar o scanner - mostra fallback direto
    if (isIOSPWA()) {
      addDebugLog('⚠️ iOS PWA detectado - scanner ao vivo não funciona');
      setScannerError('O scanner ao vivo não funciona em apps instalados no iPhone. Use uma das opções abaixo:');
      return;
    }

    if (isStartingRef.current) {
      addDebugLog('⚠️ Já está iniciando');
      return;
    }

    // Reset da flag quando o modal abre
    hasProcessedScanRef.current = false;
    isStartingRef.current = true;
    setDebugLogs([]); // Limpa logs anteriores
    setScannerError(null); // Limpa erros anteriores

    const startScanner = async () => {
      try {
        addDebugLog('🚀 Iniciando scanner...');

        // Detecta se está rodando como PWA
        const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as any).standalone === true;
        addDebugLog(`📱 PWA: ${isPWA}`);

        const mobile = isMobile();
        addDebugLog(`📱 Mobile: ${mobile}`);

        // Verifica se está no iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        addDebugLog(`🍎 iOS: ${isIOS}`);

        // Solicita permissão de câmera explicitamente (importante para iOS PWA)
        try {
          addDebugLog('🔐 Solicitando permissão de câmera...');
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mobile ? 'environment' : 'user' }
          });
          // Para o stream imediatamente - só queríamos verificar a permissão
          stream.getTracks().forEach(track => track.stop());
          addDebugLog('✅ Permissão de câmera concedida');
        } catch (permErr) {
          addDebugLog('❌ Permissão negada: ' + permErr);
          throw new Error('Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do seu dispositivo.');
        }

        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        // Configuração sem forçar resolução - usa configuração nativa da câmera
        const config = {
          fps: 30,
          qrbox: { width: 300, height: 300 },
          disableFlip: false
        };

        const facingMode = mobile ? "environment" : "user";
        addDebugLog(`📷 Camera: ${facingMode}`);

        // Callback de sucesso
        const onScanSuccessCallback = async (decodedText: string) => {
          // Previne múltiplas chamadas
          if (hasProcessedScanRef.current) {
            addDebugLog('⚠️ QR já processado');
            return;
          }

          hasProcessedScanRef.current = true;
          addDebugLog('✅ QR detectado!');
          addDebugLog(`Dados: ${decodedText.substring(0, 50)}...`);

          // Chama o callback ANTES de parar o scanner
          addDebugLog('📞 Chamando callback...');
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
          addDebugLog(`⚠️ Falha ${facingMode}, tentando fallback`);

          // Fallback: tenta com a primeira câmera disponível
          try {
            const devices = await Html5Qrcode.getCameras();
            addDebugLog(`📷 ${devices.length} câmeras disponíveis`);
            if (devices && devices.length > 0) {
              addDebugLog(`Usando: ${devices[0].label || devices[0].id}`);
              await scanner.start(
                devices[0].id,
                config,
                onScanSuccessCallback,
                (errorMessage) => {
                  // Ignora erros de scan
                }
              );
            } else {
              throw new Error('Nenhuma câmera encontrada');
            }
          } catch (fallbackErr) {
            addDebugLog('❌ Fallback falhou: ' + fallbackErr);
            throw fallbackErr;
          }
        });

        addDebugLog('✅ Scanner iniciado!');
      } catch (error: any) {
        addDebugLog('❌ Erro: ' + error);
        setScannerError(error.message || 'Erro ao iniciar câmera');
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
          <div id="qr-reader-file" className="hidden"></div>

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
              <div className="absolute bottom-32 left-0 right-0 flex flex-col items-center gap-3 px-4">
                {!scannerError && (
                  <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/20">
                    <p className="text-white text-sm font-medium">Aponte para o QR Code</p>
                  </div>
                )}

                {/* Aviso de iOS PWA */}
                {isIOSPWA() && scannerError && (
                  <div className="bg-yellow-500/90 backdrop-blur-md px-6 py-4 rounded-2xl border border-yellow-300 max-w-sm">
                    <p className="text-white text-sm font-bold mb-2">⚠️ App Instalado (PWA)</p>
                    <p className="text-white text-xs mb-3">O scanner ao vivo não funciona no app instalado do iPhone. Escolha uma opção:</p>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          const url = window.location.href;
                          window.open(url, '_blank');
                        }}
                        className="w-full bg-white text-yellow-700 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-yellow-50 transition-colors"
                      >
                        🌐 Abrir no Safari
                      </button>
                      <p className="text-white text-xs text-center">ou</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                      >
                        📸 Tirar Foto do QR Code
                      </button>
                    </div>
                  </div>
                )}

                {/* Erro genérico */}
                {scannerError && !isIOSPWA() && (
                  <div className="bg-red-500/90 backdrop-blur-md px-6 py-4 rounded-2xl border border-red-300 max-w-sm">
                    <p className="text-white text-sm font-bold mb-2">❌ Erro ao iniciar câmera</p>
                    <p className="text-white text-xs">{scannerError}</p>
                  </div>
                )}

                {/* Botão de Upload como Fallback */}
                {scannerError && (
                  <div className="pointer-events-auto">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-full font-semibold text-sm shadow-lg transition-colors"
                    >
                      📸 Tirar Foto do QR Code
                    </button>
                  </div>
                )}
              </div>

              {/* Botão de Debug */}
              <div className="absolute top-20 right-4 pointer-events-auto">
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="bg-black/60 backdrop-blur-md p-2 rounded-full border border-white/20 text-white text-xs"
                >
                  {showDebug ? '🔍 Ocultar' : '🔍 Debug'}
                </button>
              </div>

              {/* Painel de Debug */}
              {showDebug && (
                <div className="absolute top-32 left-4 right-4 bg-black/80 backdrop-blur-md p-3 rounded-lg border border-white/20 max-h-64 overflow-y-auto pointer-events-auto">
                  <div className="text-white text-xs font-mono space-y-1">
                    {debugLogs.length === 0 ? (
                      <p className="text-white/60">Aguardando logs...</p>
                    ) : (
                      debugLogs.map((log, i) => (
                        <p key={i} className="break-all">{log}</p>
                      ))
                    )}
                  </div>
                </div>
              )}
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