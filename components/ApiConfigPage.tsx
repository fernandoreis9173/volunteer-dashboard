

import React from 'react';

const ApiConfigPage: React.FC = () => {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200">
            <div className="w-full max-w-lg p-8 space-y-6 bg-white rounded-2xl shadow-lg text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-red-500 text-white rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-slate-800">Configuração Incompleta</h1>
                <p className="text-slate-600">
                    As credenciais do Supabase ou de Notificação não foram encontradas.
                </p>
                <div className="mt-2 text-slate-500 bg-slate-100 p-4 rounded-lg text-left text-sm">
                    <p>Para que o aplicativo funcione, você precisa configurar as seguintes variáveis de ambiente no seu projeto:</p>
                    <div className="mt-4 space-y-2">
                        <code className="font-mono bg-slate-200 p-1 rounded block w-full">SUPABASE_URL="sua-url-do-supabase"</code>
                        <code className="font-mono bg-slate-200 p-1 rounded block w-full">SUPABASE_ANON_KEY="sua-chave-anon"</code>
                        <code className="font-mono bg-slate-200 p-1 rounded block w-full">VAPID_PUBLIC_KEY="sua-chave-publica-vapid"</code>
                    </div>
                    <p className="mt-4">Após configurar as variáveis, por favor, reinicie o seu servidor de desenvolvimento.</p>
                </div>
            </div>
        </div>
    );
};

export default ApiConfigPage;