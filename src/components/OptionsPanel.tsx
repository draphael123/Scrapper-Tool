'use client';

import { useState } from 'react';
import { AnalysisOptions, DEFAULT_OPTIONS, EXTENSION_CATEGORIES } from '@/lib/types';

interface OptionsPanelProps {
  options: AnalysisOptions;
  onChange: (options: AnalysisOptions) => void;
  aiAvailable: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function OptionsPanel({ options, onChange, aiAvailable, isOpen, onClose }: OptionsPanelProps) {
  const [localOptions, setLocalOptions] = useState<AnalysisOptions>(options);
  const [customPrefix, setCustomPrefix] = useState('');

  if (!isOpen) return null;

  const updateOption = <K extends keyof AnalysisOptions>(key: K, value: AnalysisOptions[K]) => {
    setLocalOptions(prev => ({ ...prev, [key]: value }));
  };

  const toggleExtension = (ext: string) => {
    const current = localOptions.extensionFilter;
    if (current.includes(ext)) {
      updateOption('extensionFilter', current.filter(e => e !== ext));
    } else {
      updateOption('extensionFilter', [...current, ext]);
    }
  };

  const selectCategory = (category: keyof typeof EXTENSION_CATEGORIES) => {
    const exts = EXTENSION_CATEGORIES[category];
    const allSelected = exts.every(ext => localOptions.extensionFilter.includes(ext));
    
    if (allSelected) {
      updateOption('extensionFilter', localOptions.extensionFilter.filter(e => !exts.includes(e)));
    } else {
      const newFilter = [...new Set([...localOptions.extensionFilter, ...exts])];
      updateOption('extensionFilter', newFilter);
    }
  };

  const addCustomPrefix = () => {
    if (customPrefix && !localOptions.customPrefixes.includes(customPrefix)) {
      updateOption('customPrefixes', [...localOptions.customPrefixes, customPrefix]);
      setCustomPrefix('');
    }
  };

  const removeCustomPrefix = (prefix: string) => {
    updateOption('customPrefixes', localOptions.customPrefixes.filter(p => p !== prefix));
  };

  const handleApply = () => {
    onChange(localOptions);
    onClose();
  };

  const handleReset = () => {
    setLocalOptions(DEFAULT_OPTIONS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative glass-card w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slide-up m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#00d9ff] via-[#a855f7] to-[#ec4899] flex items-center justify-center shadow-lg shadow-purple-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Analysis Options</h2>
              <p className="text-xs text-[var(--text-muted)]">Customize how files are extracted and grouped</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-6">
          
          {/* Extension Filter */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00d9ff" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span className="bg-gradient-to-r from-[#00d9ff] to-[#0099ff] bg-clip-text text-transparent">File Extension Filter</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              {localOptions.extensionFilter.length === 0 
                ? 'Showing all file types' 
                : `Filtering: ${localOptions.extensionFilter.length} extension(s) selected`}
            </p>
            
            {/* Category buttons */}
            <div className="flex flex-wrap gap-2 mb-3">
              {(Object.keys(EXTENSION_CATEGORIES) as Array<keyof typeof EXTENSION_CATEGORIES>).map(category => {
                const exts = EXTENSION_CATEGORIES[category];
                const selectedCount = exts.filter(e => localOptions.extensionFilter.includes(e)).length;
                const isPartial = selectedCount > 0 && selectedCount < exts.length;
                const isAll = selectedCount === exts.length;
                
                return (
                  <button
                    key={category}
                    onClick={() => selectCategory(category)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isAll 
                        ? 'bg-[var(--accent-primary)] text-white' 
                        : isPartial
                          ? 'bg-[var(--accent-primary)]/30 text-[var(--accent-primary)] border border-[var(--accent-primary)]'
                          : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
                    }`}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                    {selectedCount > 0 && ` (${selectedCount})`}
                  </button>
                );
              })}
              {localOptions.extensionFilter.length > 0 && (
                <button
                  onClick={() => updateOption('extensionFilter', [])}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Individual extensions */}
            {localOptions.extensionFilter.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-3 bg-[var(--bg-secondary)] rounded-lg">
                {localOptions.extensionFilter.map(ext => (
                  <span 
                    key={ext}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded text-xs"
                  >
                    .{ext}
                    <button 
                      onClick={() => toggleExtension(ext)}
                      className="hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Grouping Options */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span className="bg-gradient-to-r from-[#a855f7] to-[#ec4899] bg-clip-text text-transparent">Pattern Grouping</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Minimum Group Size</label>
                <select
                  value={localOptions.minGroupSize}
                  onChange={(e) => updateOption('minGroupSize', parseInt(e.target.value))}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value={1}>1 file (no grouping)</option>
                  <option value={2}>2 files</option>
                  <option value={3}>3 files</option>
                  <option value={5}>5 files</option>
                  <option value={10}>10 files</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Sort Groups By</label>
                <select
                  value={localOptions.sortBy}
                  onChange={(e) => updateOption('sortBy', e.target.value as AnalysisOptions['sortBy'])}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value="count">File Count</option>
                  <option value="name">Pattern Name</option>
                  <option value="extension">Extension</option>
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs text-[var(--text-muted)] block mb-1">Sort Order</label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateOption('sortOrder', 'desc')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    localOptions.sortOrder === 'desc'
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
                  }`}
                >
                  ↓ Descending
                </button>
                <button
                  onClick={() => updateOption('sortOrder', 'asc')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    localOptions.sortOrder === 'asc'
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
                  }`}
                >
                  ↑ Ascending
                </button>
              </div>
            </div>
          </section>

          {/* AI Options */}
          {aiAvailable && (
            <section>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <span className="bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] bg-clip-text text-transparent">AI Analysis Options</span>
              </h3>
              
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Minimum Confidence</label>
                <div className="flex gap-2">
                  {(['all', 'medium', 'high'] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => updateOption('confidenceThreshold', level)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        localOptions.confidenceThreshold === level
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
                      }`}
                    >
                      {level === 'all' ? 'Show All' : level.charAt(0).toUpperCase() + level.slice(1) + '+'}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Display Options */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="bg-gradient-to-r from-[#10b981] to-[#14b8a6] bg-clip-text text-transparent">Display Options</span>
            </h3>
            
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localOptions.showLineNumbers}
                  onChange={(e) => updateOption('showLineNumbers', e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                />
                <span className="text-sm text-[var(--text-secondary)]">Show line numbers where files were found</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localOptions.caseSensitive}
                  onChange={(e) => updateOption('caseSensitive', e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                />
                <span className="text-sm text-[var(--text-secondary)]">Case-sensitive pattern matching</span>
              </label>
            </div>

            <div className="mt-3">
              <label className="text-xs text-[var(--text-muted)] block mb-1">Duplicate Handling</label>
              <select
                value={localOptions.duplicateHandling}
                onChange={(e) => updateOption('duplicateHandling', e.target.value as AnalysisOptions['duplicateHandling'])}
                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              >
                <option value="highlight">Highlight duplicates</option>
                <option value="show">Show all (no highlighting)</option>
                <option value="hide">Hide duplicates</option>
              </select>
            </div>
          </section>

          {/* Custom Prefixes */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="bg-gradient-to-r from-[#f97316] to-[#fbbf24] bg-clip-text text-transparent">Custom Prefixes</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Add specific prefixes to look for (e.g., &quot;1099&quot;, &quot;W2&quot;, &quot;INV-&quot;)
            </p>
            
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={customPrefix}
                onChange={(e) => setCustomPrefix(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomPrefix()}
                placeholder="Enter prefix..."
                className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
              <button
                onClick={addCustomPrefix}
                disabled={!customPrefix}
                className="px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                Add
              </button>
            </div>

            {localOptions.customPrefixes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {localOptions.customPrefixes.map(prefix => (
                  <span 
                    key={prefix}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm"
                  >
                    <code className="text-[var(--accent-primary)]">{prefix}</code>
                    <button 
                      onClick={() => removeCustomPrefix(prefix)}
                      className="text-[var(--text-muted)] hover:text-[var(--error)]"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="btn-primary text-sm"
            >
              Apply Options
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

