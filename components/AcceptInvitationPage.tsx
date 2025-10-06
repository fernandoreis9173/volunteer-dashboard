import React, { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthView, Department } from '../types';
import SmartSearch, { SearchItem } from './SmartSearch';
import { getErrorMessage } from '../lib/utils';

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
    readOnly?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({ label, type, name, value, onChange, placeholder, required, className, readOnly }) => (
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
            readOnly={readOnly}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 text-slate-900 read-only:bg-slate-100 read-only:cursor-not-allowed"
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

const RemovableTag: React.FC<{ text: string; color: 'blue' | 'yellow'; onRemove: () => void; }> = ({ text, color, onRemove }) => {
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
            container: 'bg-blue-100 text-blue-800 border-blue-200',
            avatar: 'bg-blue-500 text-white',
            buttonHover: 'hover:bg-blue-200'
        },
        yellow: {
            container: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            avatar: 'bg-yellow-500 text-white',
            buttonHover: 'hover:bg-yellow-200'
        },
    };
    const classes = colorClasses[color];

    return (
        <div className={`inline-flex items-center pl-1 pr-1.5 py-1 rounded-full text-sm font-semibold border ${classes.container}`}>
            <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${classes.avatar}`}>
                {initials}
            </div>
            <span className="ml-2">{text}</span>
            <button
                type="button"
                onClick={onRemove}
                className={`ml-2 flex-shrink-0 p-0.5 rounded-full inline-flex items-center justify-center text-inherit ${classes.buttonHover}`}
                aria-label={`Remove ${text}`}
            >
                <svg className="h-3.5 w-3.5" stroke="currentColor" fill="none" viewBox="0 0 24 24" strokeWidth={3}>
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
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <div className="flex">
            <input 
                type="text" 
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-grow w-full px-3 py-2 bg-white border border-slate-300 rounded-l-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 text-slate-900"
            />
            <button 
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-white text-slate-700 font-bold rounded-r-lg hover:bg-slate-100 border-t border-r border-b border-slate-300"
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


// FIX: Define the props interface for the component to resolve the "Cannot find name" error.
interface AcceptInvitationPageProps {
    supabase: SupabaseClient;
    setAuthView: (view: AuthView) => void;
}

export const AcceptInvitationPage: React.FC<AcceptInvitationPageProps> = ({ supabase, setAuthView }) => {
    const [isValidating, setIsValidating] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [skills, setSkills] = useState<string[]>([]);
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
    const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([]);
    
    useEffect(() => {
        const validateTokenAndFetchData = async () => {
          setIsValidating(true);
          setError(null);
    
          // Supabase client automatically handles the token from the URL.
          // We wait for the session to be established.
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
          // The user must be in an authenticated state from the invite link.
          if (sessionError || !session || session.user.aud !== 'authenticated') {
            setError("Token de convite inválido ou ausente. Por favor, use o link do seu e-mail.");
            setIsValidating(false);
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
              setDepartments(deptData as Department[] || []);
            }
          }
          setIsValidating(false);
        };
    
        // A short delay gives the Supabase client time to process the hash.
        const timer = setTimeout(validateTokenAndFetchData, 250);
        return () => clearTimeout(timer);
    
      }, [supabase]);
    
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhone(formatPhoneNumber(e.target.value));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setAvailability(prev => ({...prev, [name]: checked}));
    };

    const handleSelectDepartment = (item: SearchItem) => {
        const department = departments.find(d => d.id === item.id);
        if (department && !selectedDepartments.some(d => d.id === department.id)) {
            setSelectedDepartments([...selectedDepartments, department]);
        }
    };

    const handleRemoveDepartment = (departmentId: number | string) => {
        setSelectedDepartments(selectedDepartments.filter(d => d.id !== departmentId));
    };

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
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                throw new Error("Sessão de convite inválida ou expirada. Por favor, use o link do seu e-mail novamente.");
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

                const volunteerUpsertPayload = {
                    user_id: user.id,
                    email: user.email!,
                    status: 'Ativo' as const,
                    name: fullName,
                    phone: phone.replace(/[^\d]/g, ''),
                    availability: JSON.stringify(selectedAvailabilityDays),
                    initials: calculatedInitials,
                    departaments: selectedDepartments.map(d => d.name),
                    skills: skills,
                };

                const { error: volunteerUpsertError } = await supabase
                    .from('volunteers')
                    .upsert(volunteerUpsertPayload, { onConflict: 'user_id' });

                if (volunteerUpsertError) {
                    console.error("Volunteer upsert error:", volunteerUpsertError);
                    throw new Error("Sua conta foi ativada, mas houve um erro ao criar seu perfil de voluntário. Por favor, contate um administrador.");
                }
            } else if (role === 'admin' || role === 'leader' || role === 'lider') {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({ id: user.id, role: role }, { onConflict: 'id' });

                if (profileError) {
                    throw new Error("Sua conta foi ativada, mas houve um erro ao criar seu perfil. Por favor, contate um administrador.");
                }

                // Cleanup: Delete the record from the 'volunteers' table if it exists.
                // This handles cases where a trigger might have incorrectly created a volunteer record.
                const { error: deleteError } = await supabase
                    .from('volunteers')
                    .delete()
                    .eq('user_id', user.id);

                if (deleteError) {
                    // Log the error but don't block the user, as this is a cleanup operation.
                    console.error("Cleanup error: Failed to delete potential volunteer record for admin/leader:", deleteError);
                }
            }
            
            setSuccessMessage('Cadastro confirmado com sucesso! Redirecionando para o painel...');
            
            setTimeout(() => {
                // The user is logged in after setting the password.
                // We just need to change the hash and let the App component take over.
                window.location.hash = '#/dashboard';
                // A full reload ensures the App's state is completely fresh.
                window.location.reload();
            }, 2000);

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
          <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-4">
            <p className="text-lg text-slate-500">Validando convite...</p>
          </div>
        );
    }

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

                {error && !successMessage ? (
                    <div className="text-center text-red-600 bg-red-50 p-4 rounded-lg">
                        <p className="font-semibold">Ocorreu um erro</p>
                        <p className="text-sm mt-1">{error}</p>
                    </div>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleAcceptInvite}>
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
                            onChange={() => {}}
                            readOnly
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
                                    <SmartSearch
                                        items={departments.filter(d => d.id != null) as SearchItem[]}
                                        selectedItems={selectedDepartments.filter(d => d.id != null) as SearchItem[]}
                                        onSelectItem={handleSelectDepartment}
                                        placeholder="Buscar por departamento..."
                                    />
                                    <div className="mt-2 flex flex-wrap gap-2 min-h-[2.5rem]">
                                        {selectedDepartments.map((department) => (
                                            <RemovableTag
                                                key={department.id}
                                                text={department.name}
                                                color="yellow"
                                                onRemove={() => handleRemoveDepartment(department.id!)}
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
                                {loading ? 'Criando Conta...' : 'Criar Conta'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};