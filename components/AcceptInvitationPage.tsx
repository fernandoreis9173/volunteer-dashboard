import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthView, Department } from '../types';
import SmartSearch, { SearchItem } from './SmartSearch';
import { getErrorMessage } from '../lib/utils';
import { LogoMobileIcon } from '../assets/icons';
import DatePicker from './DatePicker';

// --- Helper Components & Functions ---

const formatPhoneNumber = (value: string) => {
    if (!value) return '';
    const cleaned = value.replace(/\D/g, '');

    // Logic for numbers starting with 55 (Country Code)
    if (cleaned.startsWith('55') && cleaned.length > 2) {
        const ddd = cleaned.substring(2, 4);
        const rest = cleaned.substring(4);

        if (cleaned.length <= 4) return `(+55) ${ddd}`;
        if (cleaned.length <= 8) return `(+55) ${ddd} ${rest}`;
        if (cleaned.length <= 12) return `(+55) ${ddd} ${rest.substring(0, 4)}-${rest.substring(4)}`;

        // 13 digits (9 digit number)
        return `(+55) ${ddd} ${rest.substring(0, 5)}-${rest.substring(5, 9)}`;
    }

    // Fallback (Standard DDD + Number)
    const phoneNumber = cleaned.slice(0, 11);
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
    readOnly?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({ label, type, name, value, onChange, placeholder, required, className, readOnly }) => (
    <div className={className}>
        <label htmlFor={name} className="block text-sm font-medium text-slate-700 ml-1 mb-1">
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
            readOnly={readOnly}
            className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-full placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent read-only:bg-slate-50 read-only:cursor-not-allowed"
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
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
        />
        <label htmlFor={name} className="ml-2 block text-sm text-slate-700">{label}</label>
    </div>
);

const RemovableTag: React.FC<{ text: string; color: 'blue' | 'yellow'; onRemove: () => void; disabled?: boolean }> = ({ text, color, onRemove, disabled = false }) => {
    const getInitials = (name: string): string => {
        if (!name) return '??';
        const parts = name.trim().split(' ').filter(p => p);
        if (parts.length === 0) return '??';
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
    };

    const initials = getInitials(text);

    const colorClasses = {
        blue: {
            container: 'bg-blue-50 text-blue-700 border-blue-200',
            avatar: 'bg-blue-500 text-white',
            buttonHover: 'hover:bg-blue-100'
        },
        yellow: {
            container: 'bg-yellow-50 text-yellow-700 border-yellow-200',
            avatar: 'bg-yellow-500 text-white',
            buttonHover: 'hover:bg-yellow-100'
        },
    };
    const classes = colorClasses[color];

    return (
        <div className={`inline-flex items-center pl-1 pr-1.5 py-1 rounded-full text-sm font-medium border ${classes.container}`}>
            <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${classes.avatar}`}>
                {initials}
            </div>
            <span className="ml-2">{text}</span>
            <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                className={`ml-2 flex-shrink-0 p-0.5 rounded-full inline-flex items-center justify-center text-inherit ${classes.buttonHover} ${disabled ? 'hidden' : ''}`}
                aria-label={`Remove ${text}`}
            >
                <svg className="h-3.5 w-3.5" stroke="currentColor" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};

const TagInputField: React.FC<{
    label: string;
    placeholder: string;
    tags: string[];
    setTags: React.Dispatch<React.SetStateAction<string[]>>;
    color: 'blue' | 'yellow';
}> = ({ label, placeholder, tags, setTags, color }) => {
    const [inputValue, setInputValue] = useState('');

    const handleAddTag = () => {
        const trimmedInput = inputValue.trim();
        if (trimmedInput && !tags.includes(trimmedInput)) {
            setTags([...tags, trimmedInput]);
            setInputValue('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        }
    };

    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 ml-1 mb-1">{label}</label>
            <div className="flex">
                <input
                    type="text"
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-grow w-full px-4 py-3 border border-slate-200 rounded-l-full placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-5 py-3 bg-slate-100 text-slate-700 font-bold rounded-r-full hover:bg-slate-200 border border-l-0 border-slate-200 transition-colors"
                >
                    +
                </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                    <RemovableTag key={tag} text={tag} color={color} onRemove={() => handleRemoveTag(tag)} />
                ))}
            </div>
        </div>
    );
};


interface AcceptInvitationPageProps {
    setAuthView: (view: AuthView) => void;
    onRegistrationComplete: () => void;
}

export const AcceptInvitationPage: React.FC<AcceptInvitationPageProps> = ({ setAuthView, onRegistrationComplete }) => {
    const [isValidating, setIsValidating] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [skills, setSkills] = useState<string[]>([]);
    const [availability, setAvailability] = useState({
        domingo: false, segunda: false, terca: false,
        quarta: false, quinta: false, sexta: false, sabado: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isVolunteer, setIsVolunteer] = useState(false);

    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([]);
    const [areDepartmentsPreselected, setAreDepartmentsPreselected] = useState(false);

    useEffect(() => {
        const validateTokenAndFetchData = async () => {
            setIsValidating(true);
            setError(null);

            const { data: { session } } = await supabase.auth.getSession();

            if (!session || session.user.aud !== 'authenticated') {
                setIsValidating(false);
                setAuthView('login');
                return;
            }

            const user = session.user;
            setFullName(user.user_metadata?.name || '');
            setEmail(user.email || '');

            if (user.user_metadata?.role === 'volunteer') {
                setIsVolunteer(true);
                const { data: deptData, error: deptError } = await supabase
                    .from('departments')
                    .select('id, name')
                    .eq('status', 'Ativo')
                    .order('name');

                if (deptError) {
                    console.error("Could not fetch departments for volunteer", getErrorMessage(deptError));
                } else {
                    const allDepts = (deptData as Department[] || []);
                    setDepartments(allDepts);

                    const invitedDeptIds = user.user_metadata?.invited_department_ids;
                    if (Array.isArray(invitedDeptIds) && invitedDeptIds.length > 0) {
                        const preselected = allDepts.filter(d => d.id && invitedDeptIds.includes(d.id));
                        if (preselected.length > 0) {
                            setSelectedDepartments(preselected);
                            setAreDepartmentsPreselected(true);
                        }
                    }
                }
            }
            setIsValidating(false);
        };

        const timer = setTimeout(validateTokenAndFetchData, 250);
        return () => clearTimeout(timer);

    }, []);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhone(formatPhoneNumber(e.target.value));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setAvailability(prev => ({ ...prev, [name]: checked }));
    };

    const handleSelectDepartment = (item: SearchItem) => {
        const department = departments.find(d => d.id === item.id);
        if (department && !selectedDepartments.some(d => d.id === department.id)) {
            setSelectedDepartments([...selectedDepartments, department]);
        }
    };

    const handleRemoveDepartment = (departmentId: number | string) => {
        if (areDepartmentsPreselected) return;
        setSelectedDepartments(selectedDepartments.filter(d => d.id !== departmentId));
    };

    const handleAcceptInvite = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!fullName.trim()) {
            setError("Por favor, insira seu nome completo.");
            return;
        }
        if (isVolunteer && !phone.replace(/[^\d]/g, '')) {
            setError("Por favor, insira seu número de telefone.");
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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error("Sessão de convite inválida ou expirada. Por favor, use o link do seu e-mail novamente.");
            }

            let cleanPhone = phone.replace(/[^\d]/g, '');
            // Auto-add Brazil country code (55) if missing and looks like a valid BR number
            if (cleanPhone && !cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
                cleanPhone = '55' + cleanPhone;
            }

            const { data: { user: authUser }, error: updateError } = await supabase.auth.updateUser({
                password: password,
                data: {
                    name: fullName,
                    phone: cleanPhone,
                    birth_date: birthDate,
                    status: 'Ativo',
                }
            });

            if (updateError) throw updateError;
            if (!authUser) throw new Error("Não foi possível obter os dados do usuário após a atualização.");

            const user = authUser;
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

                const volunteerPayload = {
                    user_id: user.id,
                    email: user.email!,
                    name: fullName,
                    phone: cleanPhone,
                    birth_date: birthDate || null,
                    availability: JSON.stringify(selectedAvailabilityDays),
                    initials: calculatedInitials,
                    skills: skills,
                };

                const departmentIds = selectedDepartments.map(d => d.id!).filter(id => id != null);

                const { error: saveProfileError } = await supabase.functions.invoke('save-volunteer-profile', {
                    body: { volunteerData: volunteerPayload, departmentIds: departmentIds },
                });

                if (saveProfileError) {
                    console.error("save-volunteer-profile error:", saveProfileError);
                    throw new Error("Sua conta foi ativada, mas houve um erro ao criar seu perfil de voluntário. Por favor, contate um administrador.");
                }

            } else if (role === 'admin' || role === 'leader' || role === 'lider') {
                // Update profile with phone number, email, and birth date
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        name: fullName,
                        phone: cleanPhone,
                        email: user.email,
                        birth_date: birthDate || null,
                    })
                    .eq('id', user.id);

                if (profileError) {
                    console.error("Error updating profile:", profileError);
                }
            }

            setSuccessMessage('Cadastro confirmado com sucesso! Redirecionando para a tela de login...');

            await supabase.auth.signOut({ scope: 'local' });
            setAuthView('login');

        } catch (error: any) {
            const errorMessage = getErrorMessage(error);
            console.error("Error accepting invitation:", error);
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (isValidating) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white p-4">
                <p className="text-lg text-slate-500">Validando convite...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex bg-white font-sans overflow-hidden">
            {/* Left Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col items-center px-6 pt-8 pb-8 lg:p-24 bg-white relative z-10 min-h-screen overflow-y-auto">
                <div className="w-full max-w-md space-y-6 my-auto">
                    {/* Header */}
                    <div className="text-left">
                        <div className="flex items-center gap-3 mb-6">
                            <img src={LogoMobileIcon} alt="Logo" className="h-12 w-12 lg:h-16 lg:w-16" />
                            <span className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Volunteers</span>
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
                            Complete seu Cadastro
                        </h1>
                        <p className="text-slate-500 text-base lg:text-lg">
                            Você foi convidado para o Sistema de Voluntários. Preencha seus dados e crie uma senha para começar.
                        </p>
                    </div>

                    {error && !successMessage ? (
                        <div className="text-center text-red-600 bg-red-50 p-4 rounded-lg">
                            <p className="font-semibold">Ocorreu um erro</p>
                            <p className="text-sm mt-1">{error}</p>
                        </div>
                    ) : (
                        <form className="space-y-5" onSubmit={handleAcceptInvite}>
                            <InputField
                                label="Nome Completo"
                                type="text"
                                name="fullName"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />
                            <InputField
                                label="Email"
                                type="email"
                                name="email"
                                value={email}
                                onChange={() => { }}
                                readOnly
                            />
                            <InputField
                                label="Telefone"
                                type="tel"
                                name="phone"
                                value={phone}
                                onChange={handlePhoneChange}
                                placeholder="(11) 99876-5432"
                                required={isVolunteer}
                            />
                            <DatePicker
                                label="Data de Nascimento"
                                name="birthDate"
                                value={birthDate}
                                onChange={setBirthDate}
                                placeholder="DD/MM/AAAA"
                            />

                            {isVolunteer && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 ml-1 mb-1">Departamentos de Interesse</label>
                                        <SmartSearch
                                            items={departments.filter(d => d.id != null) as SearchItem[]}
                                            selectedItems={selectedDepartments.filter(d => d.id != null) as SearchItem[]}
                                            onSelectItem={handleSelectDepartment}
                                            placeholder="Buscar por departamento..."
                                            disabled={areDepartmentsPreselected}
                                        />
                                        <div className="mt-2 flex flex-wrap gap-2 min-h-[2.5rem]">
                                            {selectedDepartments.map((department) => (
                                                <RemovableTag
                                                    key={department.id}
                                                    text={department.name}
                                                    color="yellow"
                                                    onRemove={() => handleRemoveDepartment(department.id!)}
                                                    disabled={areDepartmentsPreselected}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <TagInputField
                                        label="Habilidades e Talentos"
                                        placeholder="Ex: Música, Tecnologia, Liderança..."
                                        tags={skills}
                                        setTags={setSkills}
                                        color="blue"
                                    />

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 ml-1 mb-2">Disponibilidade</label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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

                            {error && <p className="text-sm text-red-600 text-center bg-red-50 p-3 rounded-lg">{error}</p>}
                            {successMessage && <p className="text-sm text-green-600 text-center bg-green-50 p-3 rounded-lg">{successMessage}</p>}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading || !!successMessage}
                                    className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-full text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 shadow-lg shadow-blue-600/30 transition-all hover:shadow-xl hover:-translate-y-0.5"
                                >
                                    {loading ? 'Criando Conta...' : 'Criar Conta'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* Right Side - Visuals */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden flex-col justify-center items-center p-12 text-white">
                {/* Simple Background Elements */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -mr-48 -mt-48"></div>
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-400 rounded-full -ml-40 -mb-40"></div>
                </div>

                {/* Central Logo */}
                <div className="relative z-10 mb-12">
                    <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30">
                        <img src={LogoMobileIcon} className="h-16 w-16" alt="Logo" />
                    </div>
                </div>

                {/* Text Content */}
                <div className="relative z-10 text-center max-w-md">
                    <h2 className="text-4xl font-bold mb-4">Junte-se a Nós</h2>
                    <p className="text-blue-100 text-lg leading-relaxed">
                        Complete seu cadastro e faça parte de uma comunidade dedicada a fazer a diferença.
                    </p>
                </div>
            </div>
        </div>
    );
};