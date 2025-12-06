import React from 'react';
import { LogoMobileIcon } from '../assets/icons';

const TermsOfServicePage: React.FC = () => {
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
                    <h1 className="text-3xl font-bold text-slate-900 mb-8">Termos de Serviço</h1>

                    <p className="text-slate-600 mb-6">
                        Última atualização: {new Date().toLocaleDateString('pt-BR')}
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">1. Aceitação dos Termos</h2>
                    <p className="text-slate-600 mb-4">
                        Ao acessar ou usar a plataforma Volunteers, você concorda em cumprir e estar vinculado a estes Termos de Serviço.
                        Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">2. Descrição do Serviço</h2>
                    <p className="text-slate-600 mb-4">
                        O Volunteers é uma plataforma de gestão de voluntariado que facilita a organização de escalas, eventos e comunicação entre líderes e voluntários.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">3. Conta do Usuário</h2>
                    <p className="text-slate-600 mb-4">
                        Para usar certas funcionalidades, você deve se registrar e manter uma conta segura. Você é responsável por manter a confidencialidade de suas credenciais
                        e por todas as atividades que ocorrem sob sua conta.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">4. Conduta do Usuário</h2>
                    <p className="text-slate-600 mb-4">
                        Você concorda em usar a plataforma apenas para fins legais e de acordo com as políticas da sua organização. É proibido:
                    </p>
                    <ul className="list-disc pl-6 mb-4 text-slate-600">
                        <li>Usar a plataforma para qualquer finalidade ilegal ou não autorizada.</li>
                        <li>Tentar obter acesso não autorizado a sistemas ou dados.</li>
                        <li>Interferir ou interromper a integridade ou o desempenho da plataforma.</li>
                    </ul>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">5. Propriedade Intelectual</h2>
                    <p className="text-slate-600 mb-4">
                        Todos os direitos, títulos e interesses na plataforma e em seus conteúdos (excluindo o conteúdo fornecido pelos usuários) são e permanecerão de propriedade exclusiva do Volunteers e seus licenciadores.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">6. Limitação de Responsabilidade</h2>
                    <p className="text-slate-600 mb-4">
                        O Volunteers é fornecido "como está". Não garantimos que o serviço será ininterrupto ou livre de erros. Em nenhuma circunstância seremos responsáveis por quaisquer danos
                        indiretos, incidentais ou consequentes decorrentes do uso da plataforma.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">7. Modificações nos Termos</h2>
                    <p className="text-slate-600 mb-4">
                        Reservamo-nos o direito de modificar estes termos a qualquer momento. O uso continuado da plataforma após tais alterações constitui sua aceitação dos novos termos.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">8. Legislação Aplicável</h2>
                    <p className="text-slate-600 mb-4">
                        Estes termos serão regidos e interpretados de acordo com as leis do Brasil, sem considerar seus conflitos de disposições legais.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">9. Contato</h2>
                    <p className="text-slate-600 mb-4">
                        Se você tiver alguma dúvida sobre estes Termos, entre em contato conosco.
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

export default TermsOfServicePage;
