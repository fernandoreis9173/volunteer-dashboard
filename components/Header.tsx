import React from 'react';
import { LogoMobileIcon } from '@/assets/icons';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  return (
    <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10 lg:hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <img src={LogoMobileIcon} alt="Logo" className="h-10 w-10" />
          <h1 className="text-xl font-bold text-slate-800">Volunteers</h1>
        </div>
        <button onClick={onMenuClick} className="text-slate-600 p-1 rounded-md hover:bg-slate-100">
            <span className="sr-only">Abrir menu</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;