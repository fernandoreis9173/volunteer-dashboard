

import React from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

interface DisabledUserPageProps {
    supabase: SupabaseClient | null;
    userRole: string | null;
}

const DisabledUserPage: React.FC<DisabledUserPageProps> = ({ supabase, userRole }) => {
    const handleLogout = async () => {
        if (supabase) {
            await supabase.auth.signOut();
        }
    };

    const roleDisplay = userRole === 'admin' ? 'Administrador' : 'Líder';

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200">
            <div className="w-full max-w-lg p-8 space-y-6 bg-white rounded-2xl shadow-lg text-center">
                <div className="flex justify-center mb-4">
                    <div className="p-3 bg-red-500 text-white rounded-xl">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>
                </div>
                <h1 className="text-3xl font-bold text-slate-800">Conta de {roleDisplay} Desativada</h1>
                <p className="text-slate-600">
                    Sua conta de {roleDisplay.toLowerCase()} foi desativada por um administrador. Você não pode mais acessar o sistema.
                </p>
                <p className="text-slate-500 text-sm">
                    Se você acredita que isso é um erro, por favor, entre em contato com o administrador do sistema.
                </p>
                <div className="pt-4">
                    <button
                        onClick={handleLogout}
                        className="w-full inline-flex justify-center rounded-lg border border-transparent px-4 py-2 bg-slate-600 text-base font-semibold text-white shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                    >
                        Sair
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DisabledUserPage;