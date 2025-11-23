import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface ConfettiCelebrationProps {
    isOpen: boolean;
    onClose: () => void;
    volunteerName?: string;
}

const ConfettiCelebration: React.FC<ConfettiCelebrationProps> = ({ isOpen, onClose, volunteerName }) => {
    const [confetti, setConfetti] = useState<Array<{ id: number; left: number; delay: number; duration: number }>>([]);

    useEffect(() => {
        if (isOpen) {
            // Gerar confetes aleatórios
            const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
                id: i,
                left: Math.random() * 100,
                delay: Math.random() * 0.5,
                duration: 2 + Math.random() * 2,
            }));
            setConfetti(confettiPieces);

            // Fechar automaticamente após 4 segundos
            const timer = setTimeout(() => {
                onClose();
            }, 4000);

            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const modalContent = (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Confetes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {confetti.map((piece) => (
                    <div
                        key={piece.id}
                        className="confetti"
                        style={{
                            left: `${piece.left}%`,
                            animationDelay: `${piece.delay}s`,
                            animationDuration: `${piece.duration}s`,
                        }}
                    />
                ))}
            </div>

            {/* Modal de Celebração */}
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center transform transition-all duration-500 scale-0 animate-bounce-in relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Ícone de Sucesso Animado */}
                <div className="mb-6 relative">
                    <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center animate-scale-in">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-16 w-16 text-green-500 animate-check-draw"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    {/* Círculos de pulso */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-24 h-24 bg-green-300 rounded-full animate-ping opacity-20"></div>
                    </div>
                </div>

                {/* Texto de Celebração */}
                <h2 className="text-3xl font-bold text-green-600 mb-2 animate-fade-in-up">
                    🎉 Presença Confirmada! 🎉
                </h2>

                {volunteerName && (
                    <p className="text-xl font-semibold text-slate-700 mb-4 animate-fade-in-up animation-delay-200">
                        Oba, {volunteerName}!
                    </p>
                )}

                <p className="text-slate-600 mb-6 animate-fade-in-up animation-delay-300">
                    Sua presença foi registrada com sucesso! 🙌
                </p>

                {/* Emoji de Celebração */}
                <div className="text-6xl animate-bounce-slow animation-delay-400">
                    🎊
                </div>

                <style jsx>{`
          @keyframes confetti-fall {
            0% {
              transform: translateY(-100vh) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translateY(100vh) rotate(720deg);
              opacity: 0;
            }
          }

          @keyframes bounce-in {
            0% {
              transform: scale(0);
              opacity: 0;
            }
            50% {
              transform: scale(1.1);
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }

          @keyframes scale-in {
            0% {
              transform: scale(0);
            }
            50% {
              transform: scale(1.1);
            }
            100% {
              transform: scale(1);
            }
          }

          @keyframes check-draw {
            0% {
              stroke-dasharray: 0, 100;
            }
            100% {
              stroke-dasharray: 100, 0;
            }
          }

          @keyframes fade-in-up {
            0% {
              opacity: 0;
              transform: translateY(20px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes bounce-slow {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-20px);
            }
          }

          .confetti {
            position: absolute;
            width: 10px;
            height: 10px;
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #f7c948, #a055ff);
            background-size: 400% 400%;
            animation: confetti-fall linear infinite;
            top: -10px;
          }

          .confetti:nth-child(odd) {
            background: linear-gradient(45deg, #ff6b6b, #f7c948);
          }

          .confetti:nth-child(even) {
            background: linear-gradient(45deg, #4ecdc4, #a055ff);
          }

          .animate-bounce-in {
            animation: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          }

          .animate-scale-in {
            animation: scale-in 0.5s ease-out 0.3s backwards;
          }

          .animate-check-draw {
            animation: check-draw 0.5s ease-out 0.6s backwards;
          }

          .animate-fade-in-up {
            animation: fade-in-up 0.5s ease-out backwards;
          }

          .animate-bounce-slow {
            animation: bounce-slow 2s ease-in-out infinite;
          }

          .animation-delay-200 {
            animation-delay: 0.2s;
          }

          .animation-delay-300 {
            animation-delay: 0.3s;
          }

          .animation-delay-400 {
            animation-delay: 0.4s;
          }
        `}</style>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default ConfettiCelebration;
