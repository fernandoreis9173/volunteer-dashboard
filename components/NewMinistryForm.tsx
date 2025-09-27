import React, { useState, useEffect } from 'react';
import { Ministry } from '../types';

interface InputFieldProps {
    label: string;
    type: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

const InputField: React.FC<InputFieldProps> = ({ label, type, name, value, onChange, placeholder, required, className }) => (
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
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
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


const RemovableTag: React.FC<{ text: string; onRemove: () => void; }> = ({ text, onRemove }) => (
    <span className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
        {text}
        <button type="button" onClick={onRemove} className="ml-1.5 -mr-1 p-0.5 rounded-full inline-flex items-center justify-center text-inherit hover:bg-black/10">
            <svg className="h-3 w-3" stroke="currentColor" fill="none" viewBox="0 0 8 8"><path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" /></svg>
        </button>
    </span>
);

const TagInputField: React.FC<{ 
    label: string; 
    placeholder: string; 
    tags: string[]; 
    setTags: React.Dispatch<React.SetStateAction<string[]>>;
}> = ({ label, placeholder, tags, setTags }) => {
    const [inputValue, setInputValue] = useState('');

    const handleAddTag = () => {
        const trimmedInput = inputValue.trim();
        if (trimmedInput && !tags.includes(trimmedInput)) {
            setTags([...tags, trimmedInput]);
            setInputValue('');
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
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className="flex-grow w-full px-3 py-2 bg-white border border-slate-300 rounded-l-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button type="button" onClick={handleAddTag} className="px-4 py-2 bg-slate-50 text-slate-700 font-bold rounded-r-lg hover:bg-slate-100 border-t border-r border-b border-slate-300">+</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => <RemovableTag key={tag} text={tag} onRemove={() => setTags(tags.filter(t => t !== tag))} />)}
            </div>
        </div>
    );
};


interface NewMinistryFormProps {
    initialData?: Ministry | null;
    onCancel: () => void;
    onSave: (ministry: Omit<Ministry, 'created_at'>) => void;
    isSaving: boolean;
    saveError: string | null;
}

const NewMinistryForm: React.FC<NewMinistryFormProps> = ({ initialData, onCancel, onSave, isSaving, saveError }) => {
    const [formData, setFormData] = useState({ 
        name: '', 
        description: '', 
        leader: '', 
        leader_contact: '' 
    });
    const [skills, setSkills] = useState<string[]>([]);
    const [meetingDays, setMeetingDays] = useState({
        domingo: false, segunda: false, terca: false,
        quarta: false, quinta: false, sexta: false, sabado: false,
    });
    const [isActive, setIsActive] = useState(true);
    const isEditing = !!initialData;

    useEffect(() => {
        const meetingDayKeys = {
            domingo: false, segunda: false, terca: false,
            quarta: false, quinta: false, sexta: false, sabado: false,
        };

        if (initialData) {
            setFormData({ 
                name: initialData.name, 
                description: initialData.description, 
                leader: initialData.leader,
                leader_contact: initialData.leader_contact || '',
            });
            setSkills(initialData.skills_required || []);
            setIsActive(initialData.status === 'Ativo');

            const newMeetingDaysState = { ...meetingDayKeys };
            if (Array.isArray(initialData.meeting_days)) {
                initialData.meeting_days.forEach(day => {
                    if (day === 'domingo_manha' || day === 'domingo_noite') {
                        newMeetingDaysState.domingo = true;
                    } else if (day in newMeetingDaysState) {
                        newMeetingDaysState[day as keyof typeof newMeetingDaysState] = true;
                    }
                });
            }
            setMeetingDays(newMeetingDaysState);
        } else {
            setFormData({ name: '', description: '', leader: '', leader_contact: '' });
            setSkills([]);
            setMeetingDays(meetingDayKeys);
            setIsActive(true);
        }
    }, [initialData]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setMeetingDays(prev => ({...prev, [name]: checked}));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const selectedMeetingDays = Object.entries(meetingDays)
            .filter(([, isSelected]) => isSelected)
            .map(([day]) => day);

        const ministryData: Omit<Ministry, 'created_at'> = {
            id: initialData?.id,
            name: formData.name,
            description: formData.description,
            leader: formData.leader,
            leader_contact: formData.leader_contact,
            skills_required: skills,
            meeting_days: selectedMeetingDays,
            status: isActive ? 'Ativo' : 'Inativo',
        };
        onSave(ministryData);
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
             <style>{`
                input[type="checkbox"]:checked {
                    background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
                }
            `}</style>
            <div className="flex items-center space-x-3 mb-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <h2 className="text-2xl font-bold text-slate-800">{isEditing ? 'Editar Ministério' : 'Novo Ministério'}</h2>
            </div>
            <form className="space-y-6" onSubmit={handleSubmit}>
                <InputField label="Nome do Ministério" type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                    <textarea 
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField label="Líder do Ministério" type="text" name="leader" value={formData.leader} onChange={handleInputChange} required />
                    <InputField label="Contato do Líder" type="text" name="leader_contact" value={formData.leader_contact} onChange={handleInputChange} />
                </div>
                <TagInputField label="Habilidades Necessárias" placeholder="Ex: Comunicação, Ensino..." tags={skills} setTags={setSkills} />

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Dias de Reunião</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <CheckboxField label="Domingo" name="domingo" checked={meetingDays.domingo} onChange={handleCheckboxChange} />
                        <CheckboxField label="Segunda" name="segunda" checked={meetingDays.segunda} onChange={handleCheckboxChange} />
                        <CheckboxField label="Terça" name="terca" checked={meetingDays.terca} onChange={handleCheckboxChange} />
                        <CheckboxField label="Quarta" name="quarta" checked={meetingDays.quarta} onChange={handleCheckboxChange} />
                        <CheckboxField label="Quinta" name="quinta" checked={meetingDays.quinta} onChange={handleCheckboxChange} />
                        <CheckboxField label="Sexta" name="sexta" checked={meetingDays.sexta} onChange={handleCheckboxChange} />
                        <CheckboxField label="Sábado" name="sabado" checked={meetingDays.sabado} onChange={handleCheckboxChange} />
                    </div>
                </div>

                <CheckboxField label="Ministério ativo" name="ativo" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                
                <div className="pt-6 border-t border-slate-200 flex flex-wrap justify-end items-center gap-3">
                    {saveError && <p className="text-sm text-red-500 mr-auto">{saveError}</p>}
                    <button type="button" onClick={onCancel} disabled={isSaving} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50">Cancelar</button>
                    <button type="submit" disabled={isSaving} className="px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 flex items-center space-x-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4zm2 0v12h6V4H7zm3 1a.5.5 0 00-.5.5v2.5a.5.5 0 001 0V6a.5.5 0 00-.5-.5z" clipRule="evenodd" />
                        </svg>
                        <span>{isSaving ? 'Salvando...' : 'Salvar Ministério'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default NewMinistryForm;