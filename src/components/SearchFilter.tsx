'use client';

import { useState, useEffect, useRef } from 'react';

interface SearchFilterProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  totalResults?: number;
  filteredResults?: number;
}

export function SearchFilter({ 
  onSearch, 
  placeholder = 'Search file names...', 
  totalResults,
  filteredResults 
}: SearchFilterProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  // Keyboard shortcut (Ctrl/Cmd + F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative">
      <div 
        className={`flex items-center gap-2 bg-[var(--bg-card)] border rounded-lg px-3 py-2 transition-all ${
          isFocused 
            ? 'border-[var(--accent-primary)] shadow-lg shadow-[var(--accent-glow)]' 
            : 'border-[var(--border-color)]'
        }`}
      >
        <svg 
          width="18" 
          height="18" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className={`shrink-0 transition-colors ${isFocused ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />

        {query && (
          <button
            onClick={handleClear}
            className="shrink-0 p-1 hover:bg-[var(--bg-card-hover)] rounded transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        <span className="shrink-0 text-xs text-[var(--text-muted)] hidden sm:inline">
          ⌘F
        </span>
      </div>

      {/* Results count */}
      {query && filteredResults !== undefined && totalResults !== undefined && (
        <div className="absolute right-0 top-full mt-1 text-xs text-[var(--text-muted)]">
          {filteredResults === totalResults 
            ? `${totalResults} results`
            : `${filteredResults} of ${totalResults} results`
          }
        </div>
      )}
    </div>
  );
}

