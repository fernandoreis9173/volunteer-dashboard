import React, { useState, useMemo, useRef, useEffect } from 'react';

const getInitials = (name: string): string => {
    if (!name) return '??';
    const parts = name.trim().split(' ').filter(p => p);
    if (parts.length === 0) return '??';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
};

export interface SearchItem {
  id: number | string;
  name: string;
}

interface SmartSearchProps {
  items: SearchItem[];
  selectedItems: SearchItem[];
  onSelectItem: (item: SearchItem) => void;
  placeholder?: string;
}

const SmartSearch: React.FC<SmartSearchProps> = ({ items, selectedItems, onSelectItem, placeholder }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredItems = useMemo(() => {
    const selectedIds = new Set(selectedItems.map(item => item.id));
    const availableItems = items.filter(item => !selectedIds.has(item.id));

    if (!query) {
      return availableItems;
    }
    
    const lowercasedQuery = query.toLowerCase();
    return availableItems.filter(item =>
      item.name.toLowerCase().includes(lowercasedQuery)
    );
  }, [query, items, selectedItems]);

  const handleSelect = (item: SearchItem) => {
    onSelectItem(item);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={searchContainerRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 text-slate-900"
      />
      {isOpen && (
        <ul className="absolute z-10 w-full bg-white border border-slate-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-auto">
          {filteredItems.length > 0 ? (
            filteredItems.map(item => (
              <li
                key={item.id}
                onMouseDown={() => handleSelect(item)}
                className="px-3 py-2 hover:bg-slate-100 cursor-pointer flex items-center space-x-3"
              >
                <div className="w-8 h-8 rounded-full bg-yellow-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-xs">
                    {getInitials(item.name)}
                </div>
                <div>
                    <p className="font-semibold text-slate-800 text-sm">{item.name}</p>
                </div>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-slate-500">Nenhum resultado encontrado.</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SmartSearch;