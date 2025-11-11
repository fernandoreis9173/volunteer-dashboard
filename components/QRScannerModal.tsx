import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  scanningEventName?: string | null;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScanSuccess, scanningEventName }) => {
  const qrcodeRegionId = "qr-reader-region";
  // Use a ref to persist the scanner instance across re-renders
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    
    // Initialize the scanner instance if it doesn't exist
    if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(qrcodeRegionId, { verbose: false });
    }
    const html5QrCode = scannerRef.current;

    // Configuration for the scanner view and behavior
    const config = {
      fps: 10,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const qrboxSize = Math.floor(minEdge * 0.8);
        return { width: qrboxSize, height: qrboxSize };
      },
    };

    const startScanner = async () => {
      try {
        // First, try to start the scanner with the rear camera ("environment").
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          onScanSuccess,
          (errorMessage) => { /* ignore errors */ }
        );
      } catch (err) {
        console.warn("QR Scanner: Failed to start with rear camera, trying any available camera.", err);
        try {
          // If the rear camera fails (e.g., on a laptop), try starting with any available camera.
          await html5QrCode.start(
            undefined, // Let the library choose the camera
            config,
            onScanSuccess,
            (errorMessage) => { /* ignore errors */ }
          );
        } catch (finalErr) {
          console.error("QR Scanner: Fatal error - could not start with any camera.", finalErr);
          // Optional: Display an error to the user within the modal.
        }
      }
    };

    startScanner();

    // Cleanup function: this will be called when the component unmounts
    // or when `isOpen` becomes false.
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => {
          console.error("QR Scanner: Failed to stop scanner cleanly.", err);
        });
      }
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
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4 text-center transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="modal-title" className="text-xl font-bold text-slate-900">Escanear QR Code</h3>
        <p className="text-sm text-slate-500 mt-1">
            Alinhe o QR Code do voluntário para o evento <br/> <span className="font-semibold">{scanningEventName}</span>.
        </p>
        
        <div className="my-6 w-full max-w-sm mx-auto overflow-hidden rounded-lg relative bg-slate-900" style={{ height: '400px', width: '100%' }}>
            <div id={qrcodeRegionId} className="w-full h-full" style={{ position: 'relative' }}></div>
            <div className="absolute inset-0 scanner-overlay pointer-events-none">
                <div className="scanner-line"></div>
                <div className="corner top-left"></div>
                <div className="corner top-right"></div>
                <div className="corner bottom-left"></div>
                <div className="corner bottom-right"></div>
            </div>
        </div>

        <button
            type="button"
            className="mt-4 w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-slate-600 text-base font-semibold text-white shadow-sm hover:bg-slate-700 sm:w-auto"
            onClick={onClose}
        >
            Cancelar
        </button>
      </div>
       <style>{`
        #${qrcodeRegionId} {
            width: 100%;
            height: 100%;
            border: none !important;
            position: relative;
            overflow: hidden;
        }
        #${qrcodeRegionId} video {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            min-width: 100%;
            min-height: 100%;
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