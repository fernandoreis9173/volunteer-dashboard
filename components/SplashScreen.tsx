import React from 'react';
import { LogoMobileIcon } from '../assets/icons';

interface SplashScreenProps {
    isVisible: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ isVisible }) => {
    if (!isVisible) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: '#ffffff', // Or use a theme color
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 9999,
                transition: 'opacity 0.3s ease-out',
                opacity: isVisible ? 1 : 0,
            }}
        >
            <img
                src={LogoMobileIcon}
                alt="Logo"
                style={{
                    width: '150px', // Adjust size as needed
                    height: 'auto',
                    animation: 'pulse 2s infinite',
                }}
            />
            <style>
                {`
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.1); }
                        100% { transform: scale(1); }
                    }
                `}
            </style>
        </div>
    );
};

export default SplashScreen;
