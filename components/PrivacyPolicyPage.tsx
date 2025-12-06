import React from 'react';
import { LogoMobileIcon } from '../assets/icons';

const PrivacyPolicyPage: React.FC = () => {
    return (
        <div className="h-screen w-full overflow-y-auto bg-white">
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src={LogoMobileIcon} alt="Volunteers" className="h-8 w-8" />
                        <span className="font-bold text-slate-900 text-lg">Volunteers</span>
                    </div>
                    <a href="#/login" className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        Voltar para Login
                    </a>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="prose prose-slate lg:prose-lg mx-auto">
                    <h1 className="text-3xl font-bold text-slate-900 mb-8">Política de Privacidade</h1>

                    <p className="text-slate-600 mb-6">
                        Última atualização: {new Date().toLocaleDateString('pt-BR')}
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">1. Introdução</h2>
                    <p className="text-slate-600 mb-4">
                        Bem-vindo ao Volunteers. Respeitamos a sua privacidade e estamos comprometidos em proteger as suas informações pessoais.
                        Esta Política de Privacidade explica como coletamos, usamos, divulgamos e protegemos os seus dados quando você utiliza nossa plataforma.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">2. Coleta de Informações</h2>
                    <p className="text-slate-600 mb-4">
                        Coletamos informações que você nos fornece diretamente, como:
                    </p>
                    <ul className="list-disc pl-6 mb-4 text-slate-600">
                        <li>Informações de identificação pessoal (nome, e-mail, telefone).</li>
                        <li>Dados de perfil e preferências.</li>
                        <li>Informações relacionadas à sua participação em eventos e escalas.</li>
                    </ul>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">3. Uso das Informações</h2>
                    <p className="text-slate-600 mb-4">
                        Utilizamos seus dados para:
                    </p>
                    <ul className="list-disc pl-6 mb-4 text-slate-600">
                        <li>Gerenciar sua conta e participação em atividades voluntárias.</li>
                        <li>Enviar notificações importantes sobre escalas e eventos.</li>
                        <li>Melhorar e personalizar sua experiência na plataforma.</li>
                        <li>Garantir a segurança e integridade do nosso serviço.</li>
                    </ul>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">4. Compartilhamento de Dados</h2>
                    <p className="text-slate-600 mb-4">
                        Não vendemos suas informações pessoais. Podemos compartilhar dados apenas com:
                    </p>
                    <ul className="list-disc pl-6 mb-4 text-slate-600">
                        <li>Líderes e administradores da sua organização para fins de gestão.</li>
                        <li>Prestadores de serviço que nos ajudam a operar a plataforma (ex: serviços de hospedagem).</li>
                        <li>Autoridades legais, se exigido por lei.</li>
                    </ul>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">5. Segurança</h2>
                    <p className="text-slate-600 mb-4">
                        Implementamos medidas de segurança técnicas e organizacionais para proteger seus dados contra acesso não autorizado, alteração ou destruição.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">6. Seus Direitos</h2>
                    <p className="text-slate-600 mb-4">
                        Você tem o direito de acessar, corrigir ou excluir seus dados pessoais. Entre em contato conosco através dos canais de suporte para exercer esses direitos.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">7. Alterações nesta Política</h2>
                    <p className="text-slate-600 mb-4">
                        Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças significativas através da plataforma ou por e-mail.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">8. Contato</h2>
                    <p className="text-slate-600 mb-4">
                        Se tiver dúvidas sobre esta Política de Privacidade, entre em contato conosco através do suporte da plataforma.
                    </p>
                </div>
            </main>

            <footer className="bg-slate-50 border-t border-slate-200 py-8 mt-12">
                <div className="max-w-4xl mx-auto px-4 text-center text-slate-500 text-sm">
                    &copy; {new Date().getFullYear()} Volunteers. Todos os direitos reservados.
                </div>
            </footer>
        </div>
    );
};

export default PrivacyPolicyPage;
