import React, { useState, useEffect, useMemo } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthView, Department } from '../types';

interface AcceptInvitationPageProps {
    supabase: SupabaseClient;
    setAuthView: (view: AuthView) => void;
}


// --- Helper Components & Functions ---

const formatPhoneNumber = (value: string) => {
    if (!value) return '';
    const phoneNumber = value.replace(/\D/g, '').slice(0, 11);
    const { length } = phoneNumber;
    if (length <= 2) return `(${phoneNumber}`;
    if (length <= 6) return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2)}`;
    if (length <= 10) return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 6)}-${phoneNumber.slice(6)}`;
    return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 7)}-${phoneNumber.slice(7)}`;
};

interface InputFieldProps {
    label: string;
    type: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

const InputField: React.FC<InputFieldProps> = ({ label, type, name, value, onChange, placeholder, required, className }) => (
    <div className={className}>
        <label htmlFor={name} className="block text-sm font-medium text-slate-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input 
            type={type} 
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 text-slate-900"
        />
    </div>
);

interface CheckboxFieldProps {
    label: string;
    name: string;
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const CheckboxField: React.FC<CheckboxFieldProps> = ({ label, name, checked, onChange }) => (
    <div className="flex items-center">
        <input 
            type="checkbox" 
            name={name}
            id={name}
            checked={checked}
            onChange={onChange}
            className="appearance-none h-4 w-4 bg-white border border-slate-400 rounded checked:bg-blue-600 checked:border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        />
        <label htmlFor={name} className="ml-2 block text-sm text-slate-700">{label}</label>
    </div>
);

const RemovableTag: React.FC<{ text: string; onRemove: () => void; }> = ({ text, onRemove }) => {
    return (
        <div className="inline-flex items-center pl-3 pr-1.5 py-1 rounded-full text-sm font-semibold border bg-yellow-100 text-yellow-800 border-yellow-200">
            <span>{text}</span>
            <button
                type="button"
                onClick={onRemove}
                className="ml-2 flex-shrink-0 p-0.5 rounded-full inline-flex items-center justify-center text-inherit hover:bg-yellow-200"
                aria-label={`Remove ${text}`}
            >
                <svg className="h-3.5 w-3.5" stroke="currentColor" fill="none" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};


export const AcceptInvitationPage: React.FC<AcceptInvitationPageProps> = ({ supabase, setAuthView }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [availability, setAvailability] = useState({
        domingo: false, segunda: false, terca: false,
        quarta: false, quinta: false, sexta: false, sabado: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isVolunteer, setIsVolunteer] = useState(false);
    
    // State for department selection
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
    const [departmentSearch, setDepartmentSearch] = useState('');
    const [isDepartmentDropdownOpen, setIsDepartmentDropdownOpen] = useState(false);

    useEffect(() => {
        const hash = window.location.hash;
        if (!hash.includes('access_token')) {
            setError("Token de convite inválido ou ausente. Por favor, use o link do seu e-mail.");
        }
        
        const fetchUserDataAndDepartments = async () => {
            const { data, error } = await supabase.auth.getUser();
            if (error) {
                 console.error("Error fetching user data on mount:", error);
                 return;
            }
            if (data?.user?.user_metadata?.name) {
                setFullName(data.user.user_metadata.name);
            }
            if (data?.user?.user_metadata?.role === 'volunteer') {
                setIsVolunteer(true);
                // Fetch active departments for the volunteer to choose from
                const { data: deptData, error: deptError } = await supabase
                    .from('departments')
                    .select('id, name')
                    .eq('status', 'Ativo')
                    .order('name');
                if (deptError) {
                    console.error("Could not fetch departments for volunteer", deptError);
                } else {
                    setDepartments(deptData as Department[] || []);
                }
            }
        };
        fetchUserDataAndDepartments();
    }, [supabase]);
    
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhone(formatPhoneNumber(e.target.value));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setAvailability(prev => ({...prev, [name]: checked}));
    };

    const handleAddDepartment = (departmentName: string) => {
        if (!selectedDepartments.includes(departmentName)) {
            setSelectedDepartments([...selectedDepartments, departmentName]);
        }
        setDepartmentSearch('');
        setIsDepartmentDropdownOpen(false);
    };

    const handleRemoveDepartment = (departmentNameToRemove: string) => {
        setSelectedDepartments(selectedDepartments.filter(dep => dep !== departmentNameToRemove));
    };

    const filteredDepartments = useMemo(() => {
        if (!departmentSearch) return [];
        return departments
            .filter(d => !selectedDepartments.includes(d.name))
            .filter(d => d.name.toLowerCase().includes(departmentSearch.toLowerCase()));
    }, [departmentSearch, departments, selectedDepartments]);


    const handleAcceptInvite = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!fullName.trim()) {
            setError("Por favor, insira seu nome completo.");
            return;
        }
        if (password.length < 6) {
            setError("A senha deve ter pelo menos 6 caracteres.");
            return;
        }
        if (password !== confirmPassword) {
            setError("As senhas não coincidem. Por favor, verifique.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // FIX: Explicitly check for a valid invitation session before proceeding.
            // This prevents a race condition and resolves potential "token errors".
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                throw new Error("Sessão de convite inválida ou expirada. Por favor, use o link do seu e--mail novamente.");
            }

            const { data: authData, error: updateError } = await supabase.auth.updateUser({
                password: password,
                data: { name: fullName, status: 'Ativo' }
            });

            if (updateError) throw updateError;
            if (!authData.user) throw new Error("Não foi possível obter os dados do usuário após a atualização.");

            const user = authData.user;
            const role = user.user_metadata?.role;

            if (role === 'volunteer') {
                const selectedAvailabilityDays = Object.entries(availability)
                    .filter(([, isSelected]) => isSelected)
                    .map(([day]) => day);
                
                const nameParts = fullName.trim().split(' ').filter(p => p.length > 0);
                const calculatedInitials = (
                    (nameParts[0]?.[0] || '') + 
                    (nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] || '' : '')
                ).toUpperCase();

                const volunteerUpdatePayload = {
                    status: 'Ativo',
                    name: fullName,
                    phone: phone.replace(/[^\d]/g, ''),
                    availability: JSON.stringify(selectedAvailabilityDays),
                    initials: calculatedInitials,
                    departaments: selectedDepartments,
                };

                const { error: volunteerUpdateError } = await supabase
                    .from('volunteers')
                    .update(volunteerUpdatePayload)
                    .eq('user_id', user.id);

                if (volunteerUpdateError) {
                    console.error("Volunteer update error:", volunteerUpdateError);
                    throw new Error("Sua conta foi ativada, mas houve um erro ao atualizar seu perfil de voluntário. Por favor, contate um administrador.");
                }
            } else if (role === 'admin' || role === 'leader' || role === 'lider') {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({ id: user.id, role: role }, { onConflict: 'id' });

                if (profileError) {
                    throw new Error("Sua conta foi ativada, mas houve um erro ao criar seu perfil. Por favor, contate um administrador.");
                }
            }
            
            setSuccessMessage('Cadastro confirmado com sucesso! Redirecionando para a tela de login...');
            
            setTimeout(async () => {
                await supabase.auth.signOut();
                window.location.hash = '';
                setAuthView('login');
            }, 3000);

        } catch (error: any) {
            console.error("Error accepting invitation:", error);
            setError(error.message || 'Falha ao ativar sua conta. O link pode ter expirado ou já ter sido usado.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-4">
             <style>{`
                input[type="checkbox"]:checked {
                    background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
                }
            `}</style>
            <div className="w-full max-w-md p-6 sm:p-8 space-y-8 bg-white rounded-2xl shadow-lg">
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                      <div className="p-3 bg-blue-600 text-white rounded-xl">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                        </svg>
                      </div>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800">
                        Ative Sua Conta
                    </h1>
                    <p className="mt-2 text-slate-500">
                        Você foi convidado para o Sistema de Voluntários. Complete seu perfil e crie uma senha para começar.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleAcceptInvite}>
                    <InputField 
                        label="Nome Completo" 
                        type="text" 
                        name="fullName" 
                        value={fullName} 
                        onChange={(e) => setFullName(e.target.value)} 
                        required 
                    />

                    {isVolunteer && (
                        <>
                            <InputField 
                                label="Telefone" 
                                type="tel" 
                                name="phone" 
                                value={phone} 
                                onChange={handlePhoneChange} 
                                placeholder="(11) 99876-5432"
                            />

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Departamentos de Interesse</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Buscar por departamento..."
                                        value={departmentSearch}
                                        onChange={(e) => setDepartmentSearch(e.target.value)}
                                        onFocus={() => setIsDepartmentDropdownOpen(true)}
                                        onBlur={() => setTimeout(() => setIsDepartmentDropdownOpen(false), 200)}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    {isDepartmentDropdownOpen && filteredDepartments.length > 0 && (
                                        <ul className="absolute z-10 w-full bg-white border border-slate-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-auto">
                                            {filteredDepartments.map((dep) => (
                                                <li
                                                    key={dep.id}
                                                    onMouseDown={() => handleAddDepartment(dep.name)}
                                                    className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-slate-800"
                                                >
                                                    {dep.name}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 min-h-[2.5rem]">
                                    {selectedDepartments.map((department) => (
                                        <RemovableTag
                                            key={department}
                                            text={department}
                                            onRemove={() => handleRemoveDepartment(department)}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Disponibilidade</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <CheckboxField label="Domingo" name="domingo" checked={availability.domingo} onChange={handleCheckboxChange} />
                                    <CheckboxField label="Segunda" name="segunda" checked={availability.segunda} onChange={handleCheckboxChange} />
                                    <CheckboxField label="Terça" name="terca" checked={availability.terca} onChange={handleCheckboxChange} />
                                    <CheckboxField label="Quarta" name="quarta" checked={availability.quarta} onChange={handleCheckboxChange} />
                                    <CheckboxField label="Quinta" name="quinta" checked={availability.quinta} onChange={handleCheckboxChange} />
                                    <CheckboxField label="Sexta" name="sexta" checked={availability.sexta} onChange={handleCheckboxChange} />
                                    <CheckboxField label="Sábado" name="sabado" checked={availability.sabado} onChange={handleCheckboxChange} />
                                </div>
                            </div>
                        </>
                    )}

                    <InputField 
                        label="Crie sua Senha"
                        type="password"
                        name="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo de 6 caracteres"
                        required
                    />
                    
                    <InputField 
                        label="Confirme sua Senha"
                        type="password"
                        name="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a senha"
                        required
                    />

                    {error && <p className="text-sm text-red-600 text-center pt-4">{error}</p>}
                    {successMessage && <p className="text-sm text-green-600 text-center pt-4">{successMessage}</p>}

                    <div className="pt-2">
                        <button type="submit" disabled={loading || !!successMessage} className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400">
                            {loading ? 'Ativando...' : 'Ativar Conta'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
