import React, { useRef, useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';

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
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);

  const capture = useCallback(() => {
    if (!scanning) return;

    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;

      canvas.width = img.width;
      canvas.height = img.height;
      context.drawImage(img, 0, 0);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        setScanning(false);
        onScanSuccess(code.data);
      }
    };
  }, [scanning, onScanSuccess]);

  useEffect(() => {
    if (isOpen) {
      setScanning(true);
    } else {
      setScanning(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!scanning) return;

    const interval = setInterval(() => {
      capture();
    }, 100); // Scan a cada 100ms

    return () => clearInterval(interval);
  }, [scanning, capture]);

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
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4 text-center transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="modal-title" className="text-xl font-bold text-slate-900">
          Escanear QR Code
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Alinhe o QR Code do voluntário para o evento <br /> 
          <span className="font-semibold">{scanningEventName}</span>.
        </p>

        <div className="my-6 mx-auto overflow-hidden rounded-lg relative bg-slate-900" 
             style={{ width: '100%', height: '400px', position: 'relative' }}>
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }}
            className="qr-webcam"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              minWidth: '100%',
              minHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'cover'
            }}
          />
          
          <div className="absolute inset-0 scanner-overlay pointer-events-none">
            <div className="scanner-line"></div>
            <div className="corner top-left"></div>
            <div className="corner top-right"></div>
            <div className="corner bottom-left"></div>
            <div className="corner bottom-right"></div>
          </div>
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <button
          type="button"
          className="mt-4 w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-slate-600 text-base font-semibold text-white shadow-sm hover:bg-slate-700 sm:w-auto"
          onClick={onClose}
        >
          Cancelar
        </button>
      </div>

      <style>{`
        .qr-webcam video {
          position: absolute !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          -webkit-transform: translate(-50%, -50%) !important;
          min-width: 100% !important;
          min-height: 100% !important;
          width: auto !important;
          height: auto !important;
          object-fit: cover !important;
        }

        .scanner-overlay {
          position: absolute;
          inset: 0;
          box-shadow: inset 0 0 0 50vmax rgba(0,0,0,0.5);
          z-index: 1;
        }

        .scanner-line {
          position: absolute;
          left: 5%;
          right: 5%;
          height: 2px;
          background: #ef4444;
          box-shadow: 0 0 10px #ef4444;
          animation: scan 2.5s infinite linear;
        }

        .corner {
          position: absolute;
          width: 30px;
          height: 30px;
          border: 5px solid #ef4444;
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