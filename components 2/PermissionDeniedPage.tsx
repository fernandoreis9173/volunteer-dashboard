import React from 'react';
import { Page } from '../types';

interface PermissionDeniedPageProps {
  onNavigate: (page: Page) => void;
}

const PermissionDeniedPage: React.FC<PermissionDeniedPageProps> = ({ onNavigate }) => {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-4">
            <div className="w-full max-w-lg p-8 space-y-6 bg-white rounded-2xl shadow-lg text-center">
                 <div className="flex justify-center mb-4">
                    <div className="p-4 bg-red-100 text-red-600 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>
                 </div>
                <h1 className="text-4xl font-bold text-slate-800">Acesso Negado</h1>
                <p className="mt-2 text-lg text-slate-600">Você não tem permissão para acessar esta página.</p>
                <p className="mt-1 text-slate-500 max-w-md mx-auto">Se você acredita que isso é um erro, por favor, entre em contato com o administrador do sistema.</p>
                <div className="pt-6">
                    <button
                        onClick={() => onNavigate('dashboard')}
                        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        Voltar para o Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PermissionDeniedPage;