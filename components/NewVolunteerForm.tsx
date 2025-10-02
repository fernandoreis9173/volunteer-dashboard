import React, { useState, useEffect } from 'react';
import { DetailedVolunteer } from '../types';

interface NewVolunteerFormProps {
    initialData?: DetailedVolunteer | null;
    onCancel: () => void;
    onSave: (volunteer: Omit<DetailedVolunteer, 'created_at'>) => void;
    isSaving: boolean;
    saveError: string | null;
}

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

const InputField: React.FC<InputFieldProps> = 
({ label, type, name, value, onChange, placeholder, required, className }) => (
    <div className={className}>
        <label className="block text-sm font-medium text-slate-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input 
            type={type} 
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

const RemovableTag: React.FC<{ text: string; color: 'blue' | 'yellow'; onRemove: () => void; }> = ({ text, color, onRemove }) => {
    const colorClasses = {
        blue: 'bg-blue-100 text-blue-800',
        yellow: 'bg-yellow-100 text-yellow-800',
    };
    return (
        <span className={`inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full ${colorClasses[color]}`}>
            {text}
            <button
                type="button"
                onClick={onRemove}
                className="ml-1.5 flex-shrink-0 -mr-1 p-0.5 rounded-full inline-flex items-center justify-center text-inherit hover:bg-black hover:bg-opacity-10"
                aria-label={`Remove ${text}`}
            >
                <svg className="h-3 w-3" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                    <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                </svg>
            </button>
        </span>
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


const NewVolunteerForm: React.FC<NewVolunteerFormProps> = ({ initialData, onCancel, onSave, isSaving, saveError }) => {
    const [skills, setSkills] = useState<string[]>([]);
    const [ministries, setMinistries] = useState<string[]>([]);
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
    });
    const [availability, setAvailability] = useState({
        domingo: false, segunda: false, terca: false,
        quarta: false, quinta: false, sexta: false, sabado: false,
    });
    const [isActive, setIsActive] = useState(true);
    const isEditing = !!initialData;

    const formatPhoneNumber = (value: string) => {
        if (!value) return '';

        const phoneNumber = value.replace(/\D/g, '').slice(0, 11);
        const { length } = phoneNumber;

        if (length <= 2) {
            return `(${phoneNumber}`;
        }
        if (length <= 6) {
            return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2)}`;
        }
        if (length <= 10) {
            return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 6)}-${phoneNumber.slice(6)}`;
        }
        return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 7)}-${phoneNumber.slice(7)}`;
    };

    useEffect(() => {
        const availabilityKeys = {
            domingo: false, segunda: false, terca: false,
            quarta: false, quinta: false, sexta: false, sabado: false,
        };

        if (initialData) {
            setFormData({
                fullName: initialData.name,
                email: initialData.email,
                phone: initialData.phone ? formatPhoneNumber(initialData.phone) : '',
            });
            setSkills(initialData.skills || []);
            setMinistries(initialData.ministries || []);
            setIsActive(initialData.status === 'Ativo');
            
            let availabilityArray: string[] = [];
            const rawAvailability: any = initialData.availability;

            if (Array.isArray(rawAvailability)) {
                availabilityArray = rawAvailability;
            } else if (typeof rawAvailability === 'string' && rawAvailability.startsWith('[') && rawAvailability.endsWith(']')) {
                try {
                    const parsed = JSON.parse(rawAvailability);
                    if(Array.isArray(parsed)) {
                        availabilityArray = parsed;
                    }
                } catch (e) {
                    console.error("Failed to parse availability string:", e);
                }
            }
            
            const newAvailabilityState = { ...availabilityKeys };
            
            availabilityArray.forEach(day => {
                if (day === 'domingo_manha' || day === 'domingo_noite') {
                    newAvailabilityState.domingo = true;
                } else if (day in newAvailabilityState) {
                    newAvailabilityState[day as keyof typeof newAvailabilityState] = true;
                }
            });
            setAvailability(newAvailabilityState);
        } else {
            // Reset form for new volunteer
            setFormData({ fullName: '', email: '', phone: '' });
            setSkills([]);
            setMinistries([]);
            setIsActive(true);
            setAvailability(availabilityKeys);
        }
    }, [initialData]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'phone') {
            const formattedPhone = formatPhoneNumber(value);
            setFormData(prev => ({...prev, [name]: formattedPhone}));
        } else {
            setFormData(prev => ({...prev, [name]: value}));
        }
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setAvailability(prev => ({...prev, [name]: checked}));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName || !formData.email) {
            alert('Por favor, preencha o Nome Completo e o Email.');
            return;
        }

        const nameParts = formData.fullName.trim().split(' ');
        const initials = ((nameParts[0]?.[0] || '') + (nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] || '' : '')).toUpperCase();
        
        const selectedAvailabilityDays = Object.entries(availability)
            .filter(([, isSelected]) => isSelected)
            .map(([day]) => day);

        const volunteerData: Omit<DetailedVolunteer, 'created_at'> = {
            id: initialData?.id,
            name: formData.fullName,
            email: formData.email,
            phone: formData.phone.replace(/[^\d]/g, ''),
            initials,
            status: isActive ? 'Ativo' : 'Inativo',
            ministries,
            skills,
            availability: selectedAvailabilityDays,
        };

        onSave(volunteerData);
    };
    
    return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
             <style>{`
                input[type="checkbox"]:checked {
                    background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
                }
            `}</style>
            <div className="flex items-center space-x-3 mb-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <h2 className="text-2xl font-bold text-slate-800">{isEditing ? 'Editar Voluntário' : 'Novo Voluntário'}</h2>
            </div>
            
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField label="Nome Completo" type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} required />
                    <InputField label="Email" type="email" name="email" value={formData.email} onChange={handleInputChange} required />
                </div>
                
                <InputField label="Telefone" type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="(11) 99876-5432" />
                
                <TagInputField 
                    label="Habilidades e Talentos" 
                    placeholder="Ex: Música, Tecnologia, Liderança..." 
                    tags={skills}
                    setTags={setSkills}
                    color="blue"
                />
                
                <TagInputField 
                    label="Departamentos de Interesse" 
                    placeholder="Ex: Louvor, Crianças, Jovens..." 
                    tags={ministries}
                    setTags={setMinistries}
                    color="yellow"
                />

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Disponibilidade</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <CheckboxField label="Domingo" name="domingo" checked={availability.domingo} onChange={handleCheckboxChange} />
                        <CheckboxField label="Segunda-feira" name="segunda" checked={availability.segunda} onChange={handleCheckboxChange} />
                        <CheckboxField label="Terça-feira" name="terca" checked={availability.terca} onChange={handleCheckboxChange} />
                        <CheckboxField label="Quarta-feira" name="quarta" checked={availability.quarta} onChange={handleCheckboxChange} />
                        <CheckboxField label="Quinta-feira" name="quinta" checked={availability.quinta} onChange={handleCheckboxChange} />
                        <CheckboxField label="Sexta-feira" name="sexta" checked={availability.sexta} onChange={handleCheckboxChange} />
                        <CheckboxField label="Sábado" name="sabado" checked={availability.sabado} onChange={handleCheckboxChange} />
                    </div>
                </div>

                <CheckboxField label="Voluntário ativo" name="ativo" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                
                <div className="pt-6 border-t border-slate-200 flex flex-wrap justify-end items-center gap-3">
                    {saveError && <p className="text-sm text-red-500 mr-auto">{saveError}</p>}
                    <button 
                        type="button" 
                        onClick={onCancel}
                        disabled={isSaving}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit"
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors shadow-sm disabled:bg-blue-400 disabled:cursor-not-allowed"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4zm2 0v12h6V4H7zm3 1a.5.5 0 00-.5.5v2.5a.5.5 0 001 0V6a.5.5 0 00-.5-.5z" clipRule="evenodd" />
                        </svg>
                        <span>{isSaving ? 'Salvando...' : (isEditing ? 'Atualizar Voluntário' : 'Salvar Voluntário')}</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default NewVolunteerForm;