import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';
import { TimelineTemplate } from '../types';
import TimelineEditorForm from './TimelineEditorForm';
import ConfirmationModal from './ConfirmationModal';
import BulkAssociateTimelineModal from './BulkAssociateTimelineModal';

const TimelinesPage: React.FC = () => {
    const [templates, setTemplates] = useState<TimelineTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<TimelineTemplate | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState<TimelineTemplate | null>(null);
    const [isBulkAssociateModalOpen, setIsBulkAssociateModalOpen] = useState(false);

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('cronograma_modelos')
                .select('*, cronograma_itens(*)')
                .order('nome_modelo', { ascending: true });

            if (error) throw error;
            setTemplates(data || []);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const handleNewTemplate = () => {
        setEditingTemplate(null);
        setIsFormVisible(true);
    };

    const handleEditTemplate = (template: TimelineTemplate) => {
        setEditingTemplate(template);
        setIsFormVisible(true);
    };

    const handleSaveTemplate = async () => {
        await fetchTemplates();
        setIsFormVisible(false);
        setEditingTemplate(null);
    };
    
    const handleCancel = () => {
        setIsFormVisible(false);
        setEditingTemplate(null);
    };

    const handleDeleteRequest = (template: TimelineTemplate) => {
        setTemplateToDelete(template);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!templateToDelete?.id) return;
        try {
            const { error: itemError } = await supabase.from('cronograma_itens').delete().eq('modelo_id', templateToDelete.id);
            if (itemError) throw itemError;

            const { error: templateError } = await supabase.from('cronograma_modelos').delete().eq('id', templateToDelete.id);
            if (templateError) throw templateError;

            await fetchTemplates();
        } catch (err) {
            alert(`Erro ao excluir modelo: ${getErrorMessage(err)}`);
        } finally {
            setIsDeleteModalOpen(false);
            setTemplateToDelete(null);
        }
    };

    const totalDuration = (template: TimelineTemplate) => {
        const totalMinutes = (template.cronograma_itens || []).reduce((sum, item) => sum + (item.duracao_minutos || 0), 0);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}h ${String(minutes).padStart(2, '0')}min`;
    };
    
    const renderContent = () => {
        if (loading) return <p className="text-center text-slate-500 mt-10">Carregando modelos...</p>;
        if (error) return <p className="text-center text-red-500 mt-10">{error}</p>;
        
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {templates.map(template => (
                    <div key={template.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                        <div className="flex-grow">
                            <h3 className="font-bold text-slate-800 text-lg">{template.nome_modelo}</h3>
                            <div className="mt-3 space-y-2 text-sm text-slate-600">
                                <div className="flex items-center space-x-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span>Duração Total: <strong>{totalDuration(template)}</strong></span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                                    <span>Itens: <strong>{(template.cronograma_itens || []).length}</strong></span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                            <button onClick={() => handleEditTemplate(template)} className="px-3 py-1.5 text-sm font-semibold text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200">Editar</button>
                            <button onClick={() => handleDeleteRequest(template)} className="px-3 py-1.5 text-sm font-semibold text-red-700 bg-red-100 rounded-md hover:bg-red-200">Excluir</button>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Cronogramas</h1>
                    <p className="text-slate-500 mt-1">Crie e gerencie modelos de cronograma para os eventos.</p>
              </div>
                {!isFormVisible && (
                    <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                        <button onClick={() => setIsBulkAssociateModalOpen(true)} className="w-full md:w-auto justify-center bg-green-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700 transition-colors shadow-sm">
                            
                           <span>Associar a Eventos</span>
                        </button>
                        <button onClick={handleNewTemplate} className="w-full md:w-auto justify-center bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                            <span>Novo Modelo</span>
                        </button>
                    </div>
                )}
            </div>
            
            {isFormVisible ? (
                <TimelineEditorForm
                    initialData={editingTemplate}
                    onSave={handleSaveTemplate}
                    onCancel={handleCancel}
                />
            ) : renderContent()}

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Confirmar Exclusão"
                message={`Tem certeza que deseja excluir o modelo "${templateToDelete?.nome_modelo}"? Esta ação não pode ser desfeita.`}
            />
            <BulkAssociateTimelineModal
                isOpen={isBulkAssociateModalOpen}
                onClose={() => setIsBulkAssociateModalOpen(false)}
                templates={templates}
            />
        </div>
    );
};

export default TimelinesPage;