import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { BrowserQRCodeReader } from '@zxing/browser';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  scanningEventName?: string | null;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ 
  isOpen, 
  onClose, 
  onScanSuccess, 
  scanningEventName 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<any>(null);
  const isStartingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch (e) {}
        controlsRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isStartingRef.current = false;
      return;
    }

    if (!videoRef.current || isStartingRef.current || controlsRef.current) {
      return;
    }

    isStartingRef.current = true;

    timeoutRef.current = setTimeout(async () => {
      const codeReader = new BrowserQRCodeReader();

      try {
        // Força câmera traseira e proporção vertical (9:16)
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 720 },
            height: { ideal: 1280 }
          }
        }).then(stream => {
          stream.getTracks().forEach(track => track.stop());
        });

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        let selectedDeviceId = videoDevices[0]?.deviceId;
        const backCamera = videoDevices.find(device => {
          const label = device.label.toLowerCase();
          return (
            label.includes('back') || 
            label.includes('rear') || 
            label.includes('traseira') ||
            label.includes('environment')
          );
        });

        if (backCamera) selectedDeviceId = backCamera.deviceId;
        else if (videoDevices.length > 1) selectedDeviceId = videoDevices[1].deviceId;

        if (selectedDeviceId && videoRef.current && !controlsRef.current) {
          controlsRef.current = await codeReader.decodeFromVideoDevice(
            selectedDeviceId,
            videoRef.current,
            (result) => {
              if (result) {
                if (controlsRef.current) {
                  try { controlsRef.current.stop(); } catch (e) {}
                  controlsRef.current = null;
                }
                isStartingRef.current = false;
                onScanSuccess(result.getText());
              }
            }
          );
        }
      } catch (error) {
        console.error('Erro ao iniciar scanner:', error);
      } finally {
        isStartingRef.current = false;
      }
    }, 100);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch (e) {}
        controlsRef.current = null;
      }
      isStartingRef.current = false;
    };
  }, [isOpen, onScanSuccess]);

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
        className="bg-white rounded-2xl shadow-xl w-full max-w-xs mx-auto text-center transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <h3 id="modal-title" className="text-lg font-bold text-slate-900">
            Escanear QR Code
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Alinhe o QR Code do voluntário para o evento <br /> 
            <span className="font-semibold">{scanningEventName}</span>.
          </p>
        </div>

        <div className="relative bg-slate-900 video-container">
          <video 
            ref={videoRef}
            className="scanner-video"
            autoPlay
            playsInline
            muted
          />
          
          <div className="absolute inset-0 scanner-overlay pointer-events-none">
            <div className="scanner-line"></div>
            <div className="corner top-left"></div>
            <div className="corner top-right"></div>
            <div className="corner bottom-left"></div>
            <div className="corner bottom-right"></div>
          </div>
        </div>

        <div className="p-4">
          <button
            type="button"
            className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-slate-600 text-sm font-semibold text-white shadow-sm hover:bg-slate-700"
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </div>

      <style>{`
        .video-container {
          aspect-ratio: 3 / 4;
          width: 100%;
          position: relative;
          overflow: hidden;
          background: #000;
        }

        .scanner-video {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: fill !important;
        }

        .scanner-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
        }

        .scanner-line {
          position: absolute;
          left: 10%;
          right: 10%;
          height: 2px;
          background: #ef4444;
          box-shadow: 0 0 10px #ef4444;
          animation: scan 2.5s infinite linear;
        }

        .corner {
          position: absolute;
          width: 25px;
          height: 25px;
          border: 4px solid #ef4444;
        }
        .corner.top-left { top: 10px; left: 10px; border-right: none; border-bottom: none; }
        .corner.top-right { top: 10px; right: 10px; border-left: none; border-bottom: none; }
        .corner.bottom-left { bottom: 10px; left: 10px; border-right: none; border-top: none; }
        .corner.bottom-right { bottom: 10px; right: 10px; border-left: none; border-top: none; }

        @keyframes scan {
          0% { top: 5%; }
          50% { top: 95%; }
          100% { top: 5%; }
        }

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

export default QRScannerModal;