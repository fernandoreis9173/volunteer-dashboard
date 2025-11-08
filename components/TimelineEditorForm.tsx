import React, { useState, useEffect, useRef } from 'react';
import { TimelineTemplate, TimelineItem, Event } from '../types';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/utils';
import SmartSearch, { type SearchItem } from './SmartSearch';

interface TimelineEditorFormProps {
    initialData: TimelineTemplate | null;
    onSave: () => void;
    onCancel: () => void;
}

const LinkManager: React.FC<{
    itemIndex: number,
    links: { id: string; url: string; title: string; }[] | undefined,
    onAdd: (itemIndex: number, link: { url: string; title: string; }) => void,
    onRemove: (itemIndex: number, linkId: string) => void,
    onUpdate: (itemIndex: number, linkId: string, updatedLink: { url: string; title: string; }) => void
}> = ({ itemIndex, links, onAdd, onRemove, onUpdate }) => {
    const [showForm, setShowForm] = useState(false);
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [editingLink, setEditingLink] = useState<{ id: string; url: string; title: string; } | null>(null);

    const handleSaveLink = () => {
        if (url && title) {
            if (editingLink) {
                onUpdate(itemIndex, editingLink.id, { url, title });
            } else {
                onAdd(itemIndex, { url, title });
            }
            setUrl('');
            setTitle('');
            setShowForm(false);
            setEditingLink(null);
        }
    };
    
    const handleCancel = () => {
        setUrl('');
        setTitle('');
        setShowForm(false);
        setEditingLink(null);
    };

    const handleEditClick = (link: { id: string; url: string; title: string; }) => {
        setEditingLink(link);
        setTitle(link.title);
        setUrl(link.url);
        setShowForm(true);
    };

    return (
        <div className="mt-3 pl-8">
            {(links || []).length > 0 && (
                <div className="space-y-2 mb-3">
                    {links.map(link => (
                        <div key={link.id} className="flex items-center justify-between bg-white p-2 rounded-md border border-slate-200">
                             <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline min-w-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.536a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                <span className="truncate" title={link.title}>{link.title}</span>
                            </a>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button type="button" onClick={() => handleEditClick(link)} className="p-1 text-slate-500 hover:bg-slate-100 rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                </button>
                                <button type="button" onClick={() => onRemove(itemIndex, link.id)} className="p-1 text-red-500 hover:bg-red-100 rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {!showForm && (
                <button type="button" onClick={() => { setEditingLink(null); setShowForm(true); setUrl(''); setTitle(''); }} className="text-xs font-semibold text-blue-600 hover:underline">
                    + Adicionar Link
                </button>
            )}

            {showForm && (
                <div className="space-y-2 p-3 bg-white rounded-md border border-slate-300">
                    <p className="text-sm font-semibold text-slate-700">{editingLink ? 'Editar Link' : 'Novo Link'}</p>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do Link (Ex: Louvor 1)" className="w-full text-sm p-1 border-slate-300 rounded-md"/>
                    <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/..." className="w-full text-sm p-1 border-slate-300 rounded-md"/>
                    <div className="flex justify-end gap-2 mt-1">
                        <button type="button" onClick={handleCancel} className="text-xs px-2 py-1 rounded-md bg-slate-200 hover:bg-slate-300">Cancelar</button>
                        <button type="button" onClick={handleSaveLink} className="text-xs px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700">{editingLink ? 'Salvar Alterações' : 'Salvar Link'}</button>
                    </div>
                </div>
            )}
        </div>
    );
};


const TimelineEditorForm: React.FC<TimelineEditorFormProps> = ({ initialData, onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [items, setItems] = useState<TimelineItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [allTemplates, setAllTemplates] = useState<TimelineTemplate[]>([]);


    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    useEffect(() => {
        if (initialData) {
            setName(initialData.nome_modelo || '');
            const sortedItems = [...(initialData.cronograma_itens || [])].sort((a, b) => a.ordem - b.ordem);
            const parsedItems = sortedItems.map(item => {
                let parsedLinks = item.links || [];
                if (typeof item.links === 'string') {
                    try {
                        parsedLinks = JSON.parse(item.links);
                    } catch (e) {
                        console.error("Failed to parse links JSON string:", e);
                        parsedLinks = [];
                    }
                }
                return {
                    ...item,
                    links: Array.isArray(parsedLinks) ? parsedLinks.map(link => ({...link, id: link.id || crypto.randomUUID()})) : []
                };
            });
            setItems(parsedItems);
        } else {
            setName('');
            setItems([]);
        }

        const fetchData = async () => {
            const { data: templatesData } = await supabase.from('cronograma_modelos').select('*, cronograma_itens(*)');
            setAllTemplates(templatesData || []);

        };
        fetchData();
    }, [initialData]);

    const handleAddItem = () => {
        const newItem: TimelineItem = {
            ordem: items.length,
            titulo_item: 'Novo Bloco',
            duracao_minutos: 10,
            detalhes: '',
            links: [],
        };
        setItems([...items, newItem]);
    };

    const handleItemChange = (index: number, field: keyof TimelineItem, value: string | number) => {
        const newItems = [...items];
        const itemToUpdate = { ...newItems[index] };
        (itemToUpdate[field] as any) = value;
        newItems[index] = itemToUpdate;
        setItems(newItems);
    };

    const handleAddLink = (itemIndex: number, link: { url: string; title: string }) => {
        if (!link.url || !link.title) return;
        const newItems = [...items];
        const currentItem = { ...newItems[itemIndex] };
        const newLink = { ...link, id: crypto.randomUUID() };
        currentItem.links = [...(currentItem.links || []), newLink];
        newItems[itemIndex] = currentItem;
        setItems(newItems);
    };

    const handleUpdateLink = (itemIndex: number, linkId: string, updatedLink: { url: string; title: string; }) => {
        const newItems = [...items];
        const currentItem = { ...newItems[itemIndex] };
        currentItem.links = (currentItem.links || []).map(link => 
            link.id === linkId ? { ...link, ...updatedLink } : link
        );
        newItems[itemIndex] = currentItem;
        setItems(newItems);
    };

    const handleRemoveLink = (itemIndex: number, linkId: string) => {
        const newItems = [...items];
        const currentItem = { ...newItems[itemIndex] };
        currentItem.links = (currentItem.links || []).filter(l => l.id !== linkId);
        newItems[itemIndex] = currentItem;
        setItems(newItems);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index).map((item, idx) => ({ ...item, ordem: idx }));
        setItems(newItems);
    };

    const handleDragSort = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        const newItems = [...items];
        const draggedItemContent = newItems.splice(dragItem.current, 1)[0];
        newItems.splice(dragOverItem.current, 0, draggedItemContent);
        dragItem.current = null;
        dragOverItem.current = null;
        setItems(newItems.map((item, index) => ({ ...item, ordem: index })));
    };
    
    const handleImportTemplate = (template: TimelineTemplate) => {
        const itemsToImport = (template.cronograma_itens || []).map(item => {
            let parsedLinks = item.links || [];
             if (typeof item.links === 'string') {
                try {
                    parsedLinks = JSON.parse(item.links);
                } catch (e) {
                    parsedLinks = [];
                }
            }
            return {
                ...item,
                links: Array.isArray(parsedLinks) ? parsedLinks.map(link => ({...link, id: link.id || crypto.randomUUID()})) : []
            };
        });
        setItems(prevItems => [...prevItems, ...itemsToImport].map((item, index) => ({ ...item, ordem: index })));
        setIsImportModalOpen(false);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError('O nome do modelo é obrigatório.');
            return;
        }
        setIsSaving(true);
        setError(null);
    
        try {
            const templatePayload = {
                id: initialData?.id,
                nome_modelo: name.trim(),
                admin_id: initialData?.admin_id, // Deixe a função lidar com o ID do usuário se for novo
            };
    
            const itemsPayload = items.map((item, index) => {
                const linksArray = Array.isArray(item.links)
                    ? item.links
                        .filter(link => link && link.url && link.title)
                        .map(({ id, ...rest }) => rest) // remove o id do lado do cliente para um payload limpo
                    : [];
                
                // Remove o id do item, pois ele é gerado pelo banco de dados
                const { id, ...itemData } = item;

                return {
                    ...itemData,
                    ordem: index,
                    duracao_minutos: Number(item.duracao_minutos) || 0,
                    links: linksArray.length > 0 ? linksArray : null,
                };
            });
    
            // Chame a edge function
            const { error: invokeError } = await supabase.functions.invoke('save-timeline-template', {
                body: {
                    template: templatePayload,
                    items: itemsPayload,
                },
            });
    
            if (invokeError) {
                // Tenta obter uma mensagem de erro mais específica da resposta da função
                if (invokeError.context && typeof invokeError.context.json === 'function') {
                    try {
                        const errorJson = await invokeError.context.json();
                        if (errorJson && errorJson.error) {
                            throw new Error(errorJson.error);
                        }
                    } catch (e) {
                        // Ignora erro de parsing, volta para a mensagem padrão
                    }
                }
                throw invokeError;
            }
    
            // Sucesso
            onSave();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsSaving(false);
        }
    };

    const renderItemList = () => {
        return (
            <div className="space-y-4">
                {items.map((item, index) => (
                    <div key={index} draggable onDragStart={() => dragItem.current = index} onDragEnter={() => dragOverItem.current = index} onDragEnd={handleDragSort} onDragOver={(e) => e.preventDefault()}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 cursor-move">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-2 w-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                                <input type="text" value={item.titulo_item} onChange={(e) => handleItemChange(index, 'titulo_item', e.target.value)} className="w-full font-bold text-slate-700 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1"/>
                            </div>
                            <div className="flex items-center gap-2 w-full justify-end">
                                <input type="number" value={item.duracao_minutos} onChange={(e) => handleItemChange(index, 'duracao_minutos', parseInt(e.target.value, 10) || 0)} className="w-24 text-right px-2 py-1 border border-slate-300 rounded-md"/>
                                <span className="text-sm text-slate-500">min</span>
                                <button onClick={() => handleRemoveItem(index)} className="p-1 text-red-500 hover:bg-red-100 rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                        <textarea value={item.detalhes} onChange={(e) => handleItemChange(index, 'detalhes', e.target.value)} placeholder="Detalhes (ex: lista de músicas, nome do preletor...)" rows={2} className="w-full text-sm px-2 py-1 border border-slate-300 rounded-md"/>
                        <LinkManager itemIndex={index} links={item.links} onAdd={handleAddLink} onRemove={handleRemoveLink} onUpdate={handleUpdateLink} />
                    </div>
                ))}
                <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={handleAddItem} className="flex-1 text-center px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200">
                        + Adicionar Bloco
                    </button>
                    <button onClick={() => setIsImportModalOpen(true)} className="flex-1 text-center px-4 py-2 text-sm font-semibold text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200">
                        Adicionar de Modelo
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">{initialData ? 'Editar Modelo de Cronograma' : 'Novo Modelo de Cronograma'}</h2>
            <div className="space-y-6">
                <div>
                    <label htmlFor="templateName" className="block text-sm font-medium text-slate-700 mb-1">Nome do Modelo *</label>
                    <input id="templateName" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Modelo - Culto Principal" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm"/>
                </div>
                
                {renderItemList()}
                
                <div className="pt-6 border-t border-slate-200">
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg" role="alert">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-blue-800">
                                    Na hora de criar ou editar seu evento na página 'Eventos', você poderá associar este cronograma a ele.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>


                <div className="pt-6 border-t border-slate-200 flex justify-end items-center gap-3">
                    {error && <p className="text-sm text-red-500 mr-auto">{error}</p>}
                    <button type="button" onClick={onCancel} className="px-4 py-2 bg-white border border-slate-300 font-semibold rounded-lg">Cancelar</button>
                    <button type="button" onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg disabled:bg-blue-400">
                        {isSaving ? 'Salvando...' : 'Salvar Modelo'}
                    </button>
                </div>
            </div>

            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
                        <h3 className="font-bold text-lg mb-4">Importar blocos de outro modelo</h3>
                        <ul className="space-y-2 max-h-80 overflow-y-auto">
                            {allTemplates.filter(t => t.id !== initialData?.id).length > 0 ? (
                                allTemplates.filter(t => t.id !== initialData?.id).map(t => (
                                    <li key={t.id} onClick={() => handleImportTemplate(t)} className="p-3 hover:bg-slate-100 rounded-md cursor-pointer">
                                        {t.nome_modelo} ({(t.cronograma_itens || []).length} itens)
                                    </li>
                                ))
                            ) : (
                                <li className="p-3 text-slate-500">Nenhum outro modelo disponível para importar.</li>
                            )}
                        </ul>
                        <div className="text-right mt-4">
                            <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 bg-slate-200 rounded-md">Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimelineEditorForm;