import React, { useEffect } from 'react';
// FIX: Corrected type names for Html5QrcodeScanner callbacks from 'QrCodeSuccessCallback' and 'QrCodeErrorCallback' to 'QrcodeSuccessCallback' and 'QrcodeErrorCallback' to match the library's exported types.
import { Html5QrcodeScanner, Html5QrcodeScanType, QrcodeSuccessCallback, QrcodeErrorCallback } from 'html5-qrcode';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  scanningEventName?: string | null;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScanSuccess, scanningEventName }) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const qrCodeRegionId = "qr-reader";
    let html5QrcodeScanner: Html5QrcodeScanner | null = null;

    // Creates a new scanner
    html5QrcodeScanner = new Html5QrcodeScanner(
      qrCodeRegionId,
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      },
      /* verbose= */ false
    );

    const successCallback: QrcodeSuccessCallback = (decodedText, decodedResult) => {
      onScanSuccess(decodedText);
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(error => {
          console.error("Failed to clear html5-qrcode-scanner.", error);
        });
      }
    };

    const errorCallback: QrcodeErrorCallback = (errorMessage) => {
      // handle scan error, usually not needed to show to user.
    };

    html5QrcodeScanner.render(successCallback, errorCallback);
    
    // --- Localization Workaround ---
    // The html5-qrcode library doesn't have built-in localization.
    // We'll use an interval to check for the elements and translate them once they appear.
    const localizationInterval = setInterval(() => {
        const permissionButton = document.getElementById('qr-reader__dashboard_section_csr_button');
        let buttonFoundAndTranslated = false;

        if (permissionButton && permissionButton.innerText.toLowerCase().includes('request camera permissions')) {
            permissionButton.innerText = 'Solicitar Permissão da Câmera';
            buttonFoundAndTranslated = true;
        }

        const fileScanLink = document.getElementById('qr-reader__dashboard_section_swaplink');
        if (fileScanLink && fileScanLink.innerText.toLowerCase().includes('scan an image file')) {
            fileScanLink.innerText = 'Escanear de um Arquivo de Imagem';
        }

        // Once the button is translated or disappears (after permission is granted), stop the interval.
        if (buttonFoundAndTranslated || !permissionButton) {
            clearInterval(localizationInterval);
        }
    }, 100);
    // --- End of Localization Workaround ---

    return () => {
      clearInterval(localizationInterval); // Ensure cleanup on component unmount.
      if (html5QrcodeScanner) {
        const scannerState = html5QrcodeScanner.getState();
        if (scannerState && scannerState !== 1 /* NOT_STARTED */) {
            html5QrcodeScanner.clear().catch(error => {
              console.error("Failed to clear html5-qrcode-scanner on cleanup.", error);
            });
        }
      }
    };
  }, [isOpen, onScanSuccess]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 transition-opacity duration-300"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4 text-center transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale"
      >
        <h3 id="modal-title" className="text-xl font-bold text-slate-900">Escanear QR Code</h3>
        <p className="text-sm text-slate-500 mt-1">
            Alinhe o QR Code do voluntário para o evento <br/> <span className="font-semibold">{scanningEventName}</span>.
        </p>
        
        <div className="my-6 w-full max-w-xs mx-auto aspect-square overflow-hidden rounded-lg" id="qr-reader"></div>

        <button
            type="button"
            className="mt-4 w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-slate-600 text-base font-semibold text-white shadow-sm hover:bg-slate-700 sm:w-auto"
            onClick={onClose}
        >
            Cancelar
        </button>
      </div>
       <style>{`
        #qr-reader {
            border: none !important;
        }
        #qr-reader video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
        }
        #qr-reader__dashboard_section_csr button {
            background-color: #3b82f6 !important; /* blue-600 */
            color: white !important;
            border: none !important;
            padding: 8px 16px !important;
            border-radius: 8px !important;
            margin-top: 1rem !important;
            font-size: 0.875rem !important;
            font-weight: 600 !important;
        }
        #qr-reader__dashboard_section_swaplink {
            color: #3b82f6 !important; /* blue-600 */
            font-size: 0.875rem !important;
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
};

export default QRScannerModal;
