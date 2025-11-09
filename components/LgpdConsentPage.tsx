import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/utils';

interface LgpdConsentPageProps {
    session: Session;
    onConsentAccepted: () => void;
}

const LgpdConsentPage: React.FC<LgpdConsentPageProps> = ({ session, onConsentAccepted }) => {
    const [isChecked, setIsChecked] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const userName = session.user.user_metadata?.name || session.user.email;

    const handleAccept = async () => {
        if (!isChecked) {
            setError("Você precisa aceitar os termos para continuar.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    lgpd_accepted: true,
                    lgpd_accepted_at: new Date().toISOString(),
                })
                .eq('id', session.user.id);
            
            if (updateError) throw updateError;
            
            // Callback para o App.tsx refazer o fetch dos dados do usuário
            onConsentAccepted();

        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-4">
            <div className="w-full max-w-2xl p-6 sm:p-8 space-y-6 bg-white rounded-2xl shadow-lg">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-800">
                        Política de Privacidade
                    </h1>
                    <p className="mt-2 text-slate-500">
                        Olá, {userName}. Antes de continuar, por favor, leia e aceite nossos termos.
                    </p>
                </div>
                
                <div className="prose prose-slate max-w-none h-80 overflow-y-auto p-4 border border-slate-200 rounded-lg bg-slate-50">
                    <h2>Política de Privacidade — Sistema de Voluntários</h2>
                    <p><em>Última atualização: 23 de outubro de 2025</em></p>
                    <p>O Sistema Volunteers valoriza a sua privacidade e protege seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).</p>
                    
                    <h3>1. Coleta de informações</h3>
                    <p>Coletamos apenas os dados necessários para o funcionamento do sistema, como:</p>
                    <ul>
                        <li>Nome completo</li>
                        <li>E-mail</li>
                        <li>Cargo ou função no ministério</li>
                        <li>Presenças e participação em eventos</li>
                    </ul>
                    <p>Esses dados são fornecidos por você ou por um líder autorizado da igreja.</p>
                    
                    <h3>2. Uso das informações</h3>
                    <p>Seus dados são utilizados para:</p>
                    <ul>
                        <li>Organizar escalas e eventos da igreja;</li>
                        <li>Registrar presença e engajamento em ministérios;</li>
                        <li>Enviar notificações e comunicados da equipe;</li>
                        <li>Melhorar a gestão de voluntários e departamentos.</li>
                    </ul>
                    
                    <h3>3. Compartilhamento</h3>
                    <p>As informações são usadas apenas internamente e não são vendidas ou compartilhadas com terceiros. Somente administradores e líderes com permissão têm acesso limitado às informações necessárias para suas funções.</p>
                    
                    <h3>4. Armazenamento e segurança</h3>
                    <p>Seus dados são armazenados em servidores protegidos e acessados apenas por usuários autenticados. O sistema utiliza conexão segura (HTTPS) e práticas recomendadas de segurança, como controle de acesso e criptografia de dados sensíveis. Registramos logs de acesso e o aceite da política (consentimento) com data/hora para fins de conformidade.</p>
                    
                    <h3>5. Seus direitos</h3>
                    <p>Você pode, a qualquer momento:</p>
                    <ul>
                        <li>Solicitar a correção ou exclusão dos seus dados;</li>
                        <li>Pedir informações sobre como eles são usados;</li>
                        <li>Revogar consentimentos concedidos.</li>
                    </ul>
                    <p>Para exercer seus direitos, entre em contato com o responsável: contato@chamachurch.com.br</p>
                    
                    <h3>6. Base legal</h3>
                    <p>Tratamos seus dados com base em finalidades legítimas relacionadas à prestação do serviço e ao cumprimento de contrato/obrigação administrativa, conforme previsto na LGPD.</p>
                    
                    <h3>7. Alterações nesta política</h3>
                    <p>Podemos atualizar esta Política de Privacidade periodicamente. A versão mais recente estará sempre disponível no sistema. Quando houver mudanças significativas, notificaremos os usuários.</p>
                </div>

                <div className="space-y-4">
                    <label htmlFor="consent" className="flex items-center space-x-3 cursor-pointer">
                        <input
                            type="checkbox"
                            id="consent"
                            checked={isChecked}
                            onChange={() => setIsChecked(!isChecked)}
                            className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-700">
                            Li e aceito a Política de Privacidade.
                        </span>
                    </label>
                    
                    {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                    
                    <button
                        onClick={handleAccept}
                        disabled={!isChecked || isLoading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
                    >
                        {isLoading ? "Salvando..." : "Continuar"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LgpdConsentPage;
