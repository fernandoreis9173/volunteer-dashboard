import React, { useState, useEffect } from 'react';
import { DetailedVolunteer, Department } from '../types';
// FIX: Imported SearchItem type and changed handler and props to fix type mismatch.
import SmartSearch, { type SearchItem } from './SmartSearch';

interface NewVolunteerFormProps {
    initialData?: DetailedVolunteer | null;
    onCancel: () => void;
    // FIX: Updated `onSave` signature to include `departmentIds` to align with the parent component's handler.
    onSave: (volunteer: Omit<DetailedVolunteer, 'created_at' | 'departments'>, departmentIds: number[]) => void;
    isSaving: boolean;
    saveError: string | null;
    departments: Department[];
    userRole: string | null;
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
    readOnly?: boolean;
}

const InputField: React.FC<InputFieldProps> = 
({ label, type, name, value, onChange, placeholder, required, className, readOnly }) => (
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
    disabled?: boolean;
}

const CheckboxField: React.FC<CheckboxFieldProps> = ({ label, name, checked, onChange, disabled = false }) => (
    <div className="flex items-center">
        <input 
            type="checkbox" 
            name={name}
            id={name}
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="appearance-none h-4 w-4 bg-white border border-slate-400 rounded checked:bg-blue-600 checked:border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-200 disabled:border-slate-300 disabled:cursor-not-allowed"
        />
        <label htmlFor={name} className={`ml-2 block text-sm ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>{label}</label>
    </div>
);

const RemovableTag: React.FC<{ text: string; color: 'blue' | 'yellow'; onRemove: () => void; disabled?: boolean; }> = ({ text, color, onRemove, disabled = false }) => {
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
                disabled={disabled}
                className={`ml-2 flex-shrink-0 p-0.5 rounded-full inline-flex items-center justify-center text-inherit ${classes.buttonHover} ${disabled ? 'hidden' : ''}`}
                aria-label={`Remove ${text}`}
            >
                <svg className="h-3.5 w-3.5" stroke="currentColor" fill="none" viewBox="0 0 24" strokeWidth={1.5} >
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
    disabled?: boolean;
}> = ({ label, placeholder, tags, setTags, color, disabled = false }) => {
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
                disabled={disabled}
                className="flex-grow w-full px-3 py-2 bg-white border border-slate-300 rounded-l-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 text-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
            <button 
                type="button"
                onClick={handleAddTag}
                disabled={disabled}
                className="px-4 py-2 bg-white text-slate-700 font-bold rounded-r-lg hover:bg-slate-100 border-t border-r border-b border-slate-300 disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
                +
            </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
                <RemovableTag key={tag} text={tag} color={color} onRemove={() => handleRemoveTag(tag)} disabled={disabled} />
            ))}
        </div>
    </div>
    );
};


const NewVolunteerForm: React.FC<NewVolunteerFormProps> = ({ initialData, onCancel, onSave, isSaving, saveError, departments, userRole }) => {
    const [skills, setSkills] = useState<string[]>([]);
    // FIX: Changed state type to match the shape of `initialData.departments` ({ id, name } objects).
    const [selectedDepartments, setSelectedDepartments] = useState<{ id: number; name: string }[]>([]);
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        initials: '',
    });
    const [availability, setAvailability] = useState({
        domingo: false, segunda: false, terca: false,
        quarta: false, quinta: false, sexta: false, sabado: false,
    });
    const [isActive, setIsActive] = useState(true);
    const isEditing = !!initialData;
    const canOnlyEditDepartments = isEditing && (userRole === 'leader' || userRole === 'lider');

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
                initials: initialData.initials || '',
            });
            setSkills(initialData.skills || []);
            setSelectedDepartments(initialData.departments || []);
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
            setFormData({ fullName: '', email: '', phone: '', initials: '' });
            setSkills([]);
            setSelectedDepartments([]);
            setIsActive(true);
            setAvailability(availabilityKeys);
        }
    }, [initialData, departments]);

    useEffect(() => {
        if (!isEditing) return;
        const name = formData.fullName.trim();
        if (!name) {
            setFormData(prev => ({...prev, initials: ''}));
            return;
        }
        const nameParts = name.split(' ').filter(p => p);
        if (nameParts.length === 0) {
            setFormData(prev => ({...prev, initials: ''}));
            return;
        }
        const newInitials = (
            (nameParts[0]?.[0] || '') + 
            (nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] || '' : '')
        ).toUpperCase();
        setFormData(prev => ({...prev, initials: newInitials}));
    }, [formData.fullName, isEditing]);


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

    const handleSelectDepartment = (item: SearchItem) => {
        const department = departments.find(d => d.id === item.id);
        if (department && department.id && !selectedDepartments.some(d => d.id === department.id)) {
            // FIX: Add a plain object {id, name} to match the state type, instead of the full Department object.
            setSelectedDepartments([...selectedDepartments, { id: department.id, name: department.name }]);
        }
    };

    const handleRemoveDepartment = (departmentId: number | string) => {
        setSelectedDepartments(selectedDepartments.filter(d => d.id !== departmentId));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.fullName || !formData.email) {
            alert('Por favor, preencha o Nome Completo e Email.');
            return;
        }
        if (isEditing && !formData.initials) {
            alert('As iniciais são obrigatórias ao editar um voluntário.');
            return;
        }
        
        const selectedAvailabilityDays = Object.entries(availability)
            .filter(([, isSelected]) => isSelected)
            .map(([day]) => day);

        const volunteerData: Omit<DetailedVolunteer, 'created_at' | 'departments'> = {
            id: initialData?.id,
            name: formData.fullName,
            email: formData.email,
            phone: isEditing ? formData.phone.replace(/[^\d]/g, '') : '',
            initials: isEditing ? formData.initials : '',
            status: isEditing ? (isActive ? 'Ativo' : 'Inativo') : 'Pendente',
            skills: isEditing ? skills : [],
            availability: isEditing ? selectedAvailabilityDays : [],
        };

        const departmentIds = selectedDepartments.map(d => d.id).filter((id): id is number => id !== undefined);
        onSave(volunteerData, departmentIds);
    };
    
    return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
             <style>{`
                input[type="checkbox"]:checked {
                    background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
                }
            `}</style>
            <div className="flex items-center space-x-3 mb-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-600" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth={1.5} >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                <h2 className="text-2xl font-bold text-slate-800">{isEditing ? 'Editar Voluntário' : 'Convidar Novo Voluntário'}</h2>
            </div>
            
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField label="Nome Completo" type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} required readOnly={canOnlyEditDepartments} />
                    <InputField label="Email" type="email" name="email" value={formData.email} onChange={handleInputChange} required readOnly={isEditing} />
                </div>

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

                {isEditing && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField label="Iniciais" type="text" name="initials" value={formData.initials} onChange={handleInputChange} placeholder="Ex: BF" required readOnly={canOnlyEditDepartments} />
                        <InputField label="Telefone" type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="(11) 99876-5432" readOnly={canOnlyEditDepartments} />
                    </div>

                    <TagInputField 
                        label="Habilidades e Talentos" 
                        placeholder="Ex: Música, Tecnologia, Liderança..." 
                        tags={skills}
                        setTags={setSkills}
                        color="blue"
                        disabled={canOnlyEditDepartments}
                    />

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Disponibilidade</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <CheckboxField label="Domingo" name="domingo" checked={availability.domingo} onChange={handleCheckboxChange} disabled={canOnlyEditDepartments} />
                            <CheckboxField label="Segunda-feira" name="segunda" checked={availability.segunda} onChange={handleCheckboxChange} disabled={canOnlyEditDepartments} />
                            <CheckboxField label="Terça-feira" name="terca" checked={availability.terca} onChange={handleCheckboxChange} disabled={canOnlyEditDepartments} />
                            <CheckboxField label="Quarta-feira" name="quarta" checked={availability.quarta} onChange={handleCheckboxChange} disabled={canOnlyEditDepartments} />
                            <CheckboxField label="Quinta-feira" name="quinta" checked={availability.quinta} onChange={handleCheckboxChange} disabled={canOnlyEditDepartments} />
                            <CheckboxField label="Sexta-feira" name="sexta" checked={availability.sexta} onChange={handleCheckboxChange} disabled={canOnlyEditDepartments} />
                            <CheckboxField label="Sábado" name="sabado" checked={availability.sabado} onChange={handleCheckboxChange} disabled={canOnlyEditDepartments} />
                        </div>
                    </div>
                    
                    <CheckboxField label="Voluntário ativo" name="ativo" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={canOnlyEditDepartments} />
                </>
                )}
                
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24" stroke="currentColor" strokeWidth={1.5} >
                           <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{isSaving ? 'Salvando...' : (isEditing ? 'Atualizar Voluntário' : 'Enviar Convite')}</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default NewVolunteerForm;