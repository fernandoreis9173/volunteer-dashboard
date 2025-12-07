import React, { useEffect, useState, useRef } from 'react';
import {
    LogoMobileIcon,
    CalendarIcon,
    FrequenciaIcon,
    WhatsAppIcon,
    VolunteerIcon,
    DepartamentsIcon,
    DashboardIcon,
    AdminIcon
} from '../assets/icons';

const LandingPage: React.FC = () => {
    const [scrolled, setScrolled] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            if (containerRef.current) {
                setScrolled(containerRef.current.scrollTop > 20);
            }
        };
        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (container) {
                container.removeEventListener('scroll', handleScroll);
            }
        };
    }, []);

    const scrollToSection = (id: string) => (e: React.MouseEvent) => {
        e.preventDefault();
        const section = document.getElementById(id);
        if (section && containerRef.current) {
            const top = section.offsetTop;
            containerRef.current.scrollTo({
                top: top,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div ref={containerRef} className="h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-y-auto overflow-x-hidden selection:bg-blue-100 selection:text-blue-900 scroll-smooth">
            {/* Navbar */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <img src={LogoMobileIcon} alt="Volunteers Logo" className="h-8 w-8" />
                        <span className="text-xl font-bold tracking-tight text-slate-800">Volunteers</span>
                    </div>
                    <div>
                        <a
                            href="#/dashboard"
                            className="px-6 py-2 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 text-sm"
                        >
                            Criar Conta
                        </a>
                    </div>
                </div>
            </nav>

            {/* 1. HERO */}
            <header className="relative pt-32 pb-20 lg:pt-40 lg:pb-24 overflow-hidden bg-slate-50">
                <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
                    <h1 className="text-4xl lg:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
                        Organize sua Escala de Voluntários <br className="hidden md:block" />
                        <span className="text-blue-600">sem Confusão</span>.
                    </h1>
                    <p className="max-w-2xl mx-auto text-xl text-slate-600 mb-10 leading-relaxed">
                        Automático, Simples e Rápido. O sistema perfeito para igrejas que querem organizar voluntários, departamentos e escalas — tudo em um único painel fácil de usar.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                        <a
                            href="#/dashboard"
                            className="w-full sm:w-auto px-8 py-4 rounded-full bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 hover:shadow-blue-600/40 transform hover:-translate-y-1"
                        >
                            Criar Conta
                        </a>
                        <a
                            href="#how-it-works"
                            onClick={scrollToSection('how-it-works')}
                            className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-slate-700 font-bold text-lg border border-slate-200 hover:bg-slate-50 transition-all hover:border-slate-300"
                        >
                            Ver Demonstração
                        </a>
                    </div>

                    {/* Mockup Placeholder */}
                    <div className="relative max-w-5xl mx-auto mt-8">
                        <div className="rounded-xl bg-slate-200 border-4 border-slate-300 aspect-[16/9] flex items-center justify-center shadow-2xl overflow-hidden relative group">
                            <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center text-slate-400">
                                <img src={CalendarIcon} alt="" className="w-16 h-16 mb-4 opacity-50" />
                                <span className="font-semibold text-lg">Coloque aqui um print do Calendário/Dashboard do Sistema</span>
                            </div>
                            {/* Overlay gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-50/50 to-transparent pointer-events-none"></div>
                        </div>
                    </div>
                </div>
            </header>

            {/* 2. PROBLEM (Pain Points) */}
            <section className="py-20 bg-white">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold text-slate-900 mb-12">
                        Chega de Planilhas, Grupos Caóticos e <br className="hidden md:block" /> <span className="text-red-500">Escalas Perdidas</span>.
                    </h2>

                    <div className="grid md:grid-cols-2 gap-6 text-left max-w-2xl mx-auto mb-12">
                        <div className="flex items-center gap-3 text-slate-700">
                            <span className="text-red-500 text-xl font-bold">✕</span>
                            <span>Escalas feitas em cima da hora</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-700">
                            <span className="text-red-500 text-xl font-bold">✕</span>
                            <span>Voluntário não sabia que estava escalado</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-700">
                            <span className="text-red-500 text-xl font-bold">✕</span>
                            <span>Conflitos de horários constantes</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-700">
                            <span className="text-red-500 text-xl font-bold">✕</span>
                            <span>Falta de comunicação entre líderes</span>
                        </div>
                    </div>

                    <div className="bg-blue-50 text-blue-800 px-6 py-3 rounded-full inline-block font-semibold">
                        Seu sistema resolve tudo isso automaticamente.
                    </div>
                </div>
            </section>

            {/* 3. SOLUTION (How it works) */}
            <section id="how-it-works" className="py-20 bg-slate-50 border-y border-slate-200">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900">Seu ministério organizado em 3 passos</h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Step 1 */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-blue-100 text-blue-600 font-bold px-4 py-2 rounded-bl-xl text-sm">Passo 1</div>
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <img src={DepartamentsIcon} alt="" className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Crie Departamentos</h3>
                            <p className="text-slate-600">Cada líder gerencia seus voluntários de forma independente e organizada.</p>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-blue-100 text-blue-600 font-bold px-4 py-2 rounded-bl-xl text-sm">Passo 2</div>
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <img src={VolunteerIcon} alt="" className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Adicione Voluntários</h3>
                            <p className="text-slate-600">Cadastre a equipe ou envie convites via WhatsApp ou link direto.</p>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-blue-100 text-blue-600 font-bold px-4 py-2 rounded-bl-xl text-sm">Passo 3</div>
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <img src={CalendarIcon} alt="" className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Escale com 1 clique</h3>
                            <p className="text-slate-600">O sistema avisa, notifica e evita conflitos de horário automaticamente.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. FEATURES */}
            <section className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900">Principais Funcionalidades</h2>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <FeatureCard icon={<img src={CalendarIcon} alt="" />} title="Escalas Automáticas" desc="Monte escalas por evento ou por mês com apenas 1 clique." />
                        <FeatureCard icon={<span className="text-2xl">⚠️</span>} title="Conflito Detectado" desc="O sistema alerta quando um voluntário já está escalado em outro lugar." />
                        <FeatureCard icon={<img src={WhatsAppIcon} alt="" />} title="Notificações WhatsApp" desc="Voluntários recebem lembretes de forma automática." />
                        <FeatureCard icon={<img src={VolunteerIcon} alt="" />} title="Perfis Completos" desc="Cadastro com foto, ministério, histórico e disponibilidade." />
                        <FeatureCard icon={<img src={DepartamentsIcon} alt="" />} title="Departamentos Ilimitados" desc="Louvor, Kids, Recepção, Mídia... Organize tudo separadamente." />
                        <FeatureCard icon={<img src={FrequenciaIcon} alt="" />} title="Relatório de Presença" desc="Líder confirma presença direto no evento via QR Code ou lista." />
                        <FeatureCard icon={<img src={AdminIcon} alt="" />} title="Painel Administrativo" desc="O Pastor ou Admin tem visão total de todos os ministérios." />
                        <FeatureCard icon={<img src={LogoMobileIcon} alt="" />} title="App Mobile / PWA" desc="Voluntários checam a escala direto no celular." />
                    </div>
                </div>
            </section>

            {/* 5. PRINTS (Visual Demo) */}
            <section className="py-24 bg-slate-900 text-white">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold mb-16">Simples para líderes. Rápido para voluntários.</h2>

                    <div className="grid md:grid-cols-3 gap-8">
                        <ScreenPlaceholder title="Painel do Líder" />
                        <ScreenPlaceholder title="Tela de Escala" />
                        <ScreenPlaceholder title="Visão do Voluntário" />
                    </div>

                    <div className="mt-16">
                        <a
                            href="#/dashboard"
                            className="inline-block px-10 py-4 rounded-full bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition-all shadow-lg hover:scale-105"
                        >
                            Quero testar o sistema (Grátis)
                        </a>
                    </div>
                </div>
            </section>

            {/* 7. TESTIMONIALS */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-4xl mx-auto px-6 grid md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-slate-600 italic mb-4">"Finalmente nossa escala parou de dar dor de cabeça. Os voluntários amaram a facilidade."</p>
                        <div className="font-bold text-slate-900">— Líder de Louvor</div>
                    </div>
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-slate-600 italic mb-4">"Os voluntários recebem tudo no celular. Ficou perfeito e muito organizado."</p>
                        <div className="font-bold text-slate-900">— Pastor</div>
                    </div>
                </div>
            </section>

            {/* 8. CTA FINAL */}
            <section className="py-24 bg-blue-600 text-white text-center">
                <div className="max-w-4xl mx-auto px-6">
                    <h2 className="text-4xl font-bold mb-8">Pronto para organizar sua igreja de verdade?</h2>
                    <a
                        href="#/dashboard"
                        className="inline-block bg-white text-blue-600 px-10 py-4 rounded-full font-bold text-xl hover:bg-slate-100 transition-all shadow-xl hover:scale-105"
                    >
                        Começar Agora
                    </a>
                </div>
            </section>

            {/* 9. FOOTER */}
            <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8 text-sm">
                    <div className="flex items-center gap-2">
                        <img src={LogoMobileIcon} alt="Logo" className="h-6 w-6 opacity-50 grayscale" />
                        <span className="font-semibold text-slate-500">Volunteers</span>
                    </div>

                    <div className="flex flex-wrap justify-center gap-8">
                        <a href="#" className="hover:text-white transition-colors">Sobre</a>
                        <a href="#" className="hover:text-white transition-colors">Suporte</a>
                        <a href="#" className="hover:text-white transition-colors">WhatsApp</a>
                        <a href="#" className="hover:text-white transition-colors">Instagram</a>
                    </div>

                    <div className="flex gap-4">
                        <a href="#/terms-of-service" className="hover:text-white transition-colors">Termos</a>
                        <a href="#/privacy-policy" className="hover:text-white transition-colors">Privacidade</a>
                    </div>
                </div>
                <div className="text-center mt-8 text-xs text-slate-600">
                    &copy; {new Date().getFullYear()} Volunteer Platform. Todos os direitos reservados.
                </div>
            </footer>
        </div>
    );
};

// Helper Components
const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 hover:border-blue-200 transition-all hover:shadow-md group">
        <div className="w-12 h-12 bg-white text-blue-600 rounded-lg flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
            {React.isValidElement(icon) ? React.cloneElement(icon as any, { className: 'w-6 h-6' }) : icon}
        </div>
        <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-600">{desc}</p>
    </div>
);

const ScreenPlaceholder = ({ title }: { title: string }) => (
    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-xl">
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-700 flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
        </div>
        <div className="aspect-[9/16] bg-slate-800 flex items-center justify-center p-8 text-center">
            <div>
                <img src={LogoMobileIcon} alt="" className="w-12 h-12 mx-auto mb-4 opacity-20 text-white" />
                <span className="text-slate-500 font-medium block">{title}</span>
                <span className="text-xs text-slate-600 block mt-2">(Coloque o print aqui)</span>
            </div>
        </div>
    </div>
);

export default LandingPage;
