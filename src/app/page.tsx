'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { OptionsPanel } from '@/components/OptionsPanel';
import { SearchFilter } from '@/components/SearchFilter';
import { HelpModal } from '@/components/HelpModal';
import { Tooltip } from '@/components/Tooltip';
import ProgressIndicator from '@/components/ProgressIndicator';
import { AnalysisOptions, DEFAULT_OPTIONS } from '@/lib/types';
import { exportToJSON, exportToExcel, exportToMarkdown, downloadFile } from '@/lib/exportUtils';

// Extend input element to include non-standard directory upload attributes
declare module 'react' {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

interface ExtractedFileName {
  name: string;
  extension: string;
  line?: number;
  confidence?: 'high' | 'medium' | 'low';
}

interface PatternGroup {
  pattern: string;
  files: ExtractedFileName[];
  count: number;
  description?: string;
}

interface AnalysisResult {
  totalFound: number;
  patterns: PatternGroup[];
  duplicates: string[];
  aiEnhanced?: boolean;
  summary?: string;
  documentType?: string;
}

interface ApiResponse {
  success: boolean;
  fileName: string;
  fileType: string;
  pageCount?: number;
  textLength: number;
  analysis: AnalysisResult;
  aiAvailable: boolean;
  aiUsed: boolean;
  error?: string;
}

// Extension badge colors
function getExtBadgeClass(ext: string): string {
  const extLower = ext.toLowerCase();
  if (extLower === 'pdf') return 'ext-pdf';
  if (['docx', 'doc'].includes(extLower)) return 'ext-docx';
  if (['xlsx', 'xls'].includes(extLower)) return 'ext-xlsx';
  if (extLower === 'csv') return 'ext-csv';
  if (extLower === 'txt') return 'ext-txt';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].includes(extLower)) return 'ext-jpg';
  return 'ext-default';
}

// Confidence badge
function ConfidenceBadge({ confidence }: { confidence?: 'high' | 'medium' | 'low' }) {
  if (!confidence) return null;
  
  const classes = {
    high: 'confidence-high',
    medium: 'confidence-medium',
    low: 'confidence-low'
  };
  
  return (
    <span className={`uppercase ${classes[confidence]}`}>
      {confidence}
    </span>
  );
}

// AI Toggle Switch
function AIToggle({ 
  enabled, 
  onChange, 
  available 
}: { 
  enabled: boolean; 
  onChange: (enabled: boolean) => void;
  available: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => available && onChange(!enabled)}
        disabled={!available}
        className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
          enabled 
            ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]' 
            : 'bg-[var(--bg-card)]'
        } ${!available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span 
          className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg transition-all duration-300 ${
            enabled ? 'left-8' : 'left-1'
          }`}
        />
      </button>
      <div className="flex flex-col">
        <span className={`text-sm font-medium ${enabled ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}>
          AI {enabled ? 'ON' : 'OFF'}
        </span>
        {!available && (
          <span className="text-xs text-[var(--text-muted)]">No API key</span>
        )}
      </div>
    </div>
  );
}

// Apply options to filter and sort results
function applyOptions(
  analysis: AnalysisResult, 
  options: AnalysisOptions,
  searchQuery: string
): AnalysisResult {
  let patterns = [...analysis.patterns];

  // Filter by extensions
  if (options.extensionFilter.length > 0) {
    patterns = patterns.map(group => ({
      ...group,
      files: group.files.filter(f => 
        options.extensionFilter.includes(f.extension.toLowerCase())
      ),
    })).filter(g => g.files.length > 0);
    
    // Update counts
    patterns = patterns.map(g => ({ ...g, count: g.files.length }));
  }

  // Filter by confidence threshold (AI mode only)
  if (analysis.aiEnhanced && options.confidenceThreshold !== 'all') {
    const validConfidences = options.confidenceThreshold === 'high' 
      ? ['high'] 
      : ['high', 'medium'];
    
    patterns = patterns.map(group => ({
      ...group,
      files: group.files.filter(f => 
        !f.confidence || validConfidences.includes(f.confidence)
      ),
    })).filter(g => g.files.length > 0);
    
    patterns = patterns.map(g => ({ ...g, count: g.files.length }));
  }

  // Handle duplicates
  if (options.duplicateHandling === 'hide') {
    const seen = new Set<string>();
    patterns = patterns.map(group => ({
      ...group,
      files: group.files.filter(f => {
        const key = f.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    })).filter(g => g.files.length > 0);
    
    patterns = patterns.map(g => ({ ...g, count: g.files.length }));
  }

  // Filter by search query
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    patterns = patterns.map(group => ({
      ...group,
      files: group.files.filter(f => 
        f.name.toLowerCase().includes(query) ||
        f.extension.toLowerCase().includes(query) ||
        group.pattern.toLowerCase().includes(query)
      ),
    })).filter(g => g.files.length > 0);
    
    patterns = patterns.map(g => ({ ...g, count: g.files.length }));
  }

  // Apply minimum group size (move small groups to misc)
  if (options.minGroupSize > 1) {
    const regularGroups: PatternGroup[] = [];
    const miscFiles: ExtractedFileName[] = [];
    
    for (const group of patterns) {
      if (group.pattern === 'Miscellaneous') {
        miscFiles.push(...group.files);
      } else if (group.count < options.minGroupSize) {
        miscFiles.push(...group.files);
      } else {
        regularGroups.push(group);
      }
    }
    
    if (miscFiles.length > 0) {
      regularGroups.push({
        pattern: 'Miscellaneous',
        files: miscFiles,
        count: miscFiles.length,
      });
    }
    
    patterns = regularGroups;
  }

  // Sort patterns
  patterns.sort((a, b) => {
    if (a.pattern === 'Miscellaneous') return 1;
    if (b.pattern === 'Miscellaneous') return -1;
    
    let comparison = 0;
    switch (options.sortBy) {
      case 'count':
        comparison = a.count - b.count;
        break;
      case 'name':
        comparison = a.pattern.localeCompare(b.pattern);
        break;
      case 'extension':
        const aExt = a.files[0]?.extension || '';
        const bExt = b.files[0]?.extension || '';
        comparison = aExt.localeCompare(bExt);
        break;
    }
    
    return options.sortOrder === 'desc' ? -comparison : comparison;
  });

  // Calculate new total
  const totalFound = patterns.reduce((sum, g) => sum + g.count, 0);

  return {
    ...analysis,
    patterns,
    totalFound,
  };
}

// Pattern group component
function PatternGroupCard({ 
  group, 
  index, 
  duplicates,
  aiEnhanced,
  options,
  searchQuery
}: { 
  group: PatternGroup; 
  index: number; 
  duplicates: string[];
  aiEnhanced?: boolean;
  options: AnalysisOptions;
  searchQuery: string;
}) {
  const [isOpen, setIsOpen] = useState(index === 0);
  const [showAll, setShowAll] = useState(false);
  
  const displayedFiles = showAll ? group.files : group.files.slice(0, 10);
  const hasMore = group.files.length > 10;

  // Highlight search matches
  const highlightMatch = (text: string) => {
    if (!searchQuery) return text;
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-[var(--accent-primary)]/30 text-[var(--accent-primary)] rounded px-0.5">
          {part}
        </mark>
      ) : part
    );
  };
  
  return (
    <div 
      className="pattern-card animate-slide-up opacity-0"
      data-color={index % 8}
      style={{ animationDelay: `${0.1 + index * 0.05}s` }}
    >
      <div 
        className="pattern-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={`chevron shrink-0 ${isOpen ? 'open' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </span>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-[var(--text-primary)]">
              {group.pattern === 'Miscellaneous' ? (
                <span className="text-[var(--text-secondary)]">Miscellaneous</span>
              ) : (
                <code className="bg-[var(--bg-secondary)] px-2 py-1 rounded text-sm">
                  {highlightMatch(group.pattern)}
                </code>
              )}
            </span>
            {group.description && (
              <span className="text-xs text-[var(--text-muted)] mt-1 truncate">
                {group.description}
              </span>
            )}
          </div>
        </div>
        <span className={`count-badge-${index % 8} text-white px-3 py-1.5 rounded-full text-sm font-bold shrink-0 ml-2 shadow-lg`}>
          {group.count} file{group.count !== 1 ? 's' : ''}
        </span>
      </div>
      
      {isOpen && (
        <div className="file-list animate-fade-in">
          {displayedFiles.map((file, fileIndex) => {
            const isDuplicate = duplicates.includes(file.name.toLowerCase());
            const showDupBadge = options.duplicateHandling === 'highlight' && isDuplicate;
            
            return (
              <div key={fileIndex} className="file-item flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {options.showLineNumbers && file.line && (
                    <span className="text-xs text-[var(--text-muted)] font-mono shrink-0">
                      L{file.line}
                    </span>
                  )}
                  <span className="text-[var(--text-secondary)] truncate">
                    {highlightMatch(file.name)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {aiEnhanced && file.confidence && (
                    <ConfidenceBadge confidence={file.confidence} />
                  )}
                  {showDupBadge && (
                    <span className="duplicate-badge">DUP</span>
                  )}
                  <span className={`ext-badge ${getExtBadgeClass(file.extension)}`}>
                    {file.extension}
                  </span>
                </div>
              </div>
            );
          })}
          {hasMore && (
            <button 
              className="show-more-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowAll(!showAll);
              }}
            >
              {showAll ? 'Show less' : `Show ${group.files.length - 10} more...`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Batch result types
interface BatchFileResult {
  fileName: string;
  fileType: string;
  success: boolean;
  error?: string;
  textLength?: number;
  pageCount?: number;
}

interface BatchApiResponse {
  success: boolean;
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  results: BatchFileResult[];
  combinedAnalysis: AnalysisResult & { sourceFiles: string[] };
  aiAvailable: boolean;
  aiUsed: boolean;
}

// Main component
export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [batchResult, setBatchResult] = useState<BatchApiResponse | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<AnalysisOptions>(DEFAULT_OPTIONS);
  const [showOptions, setShowOptions] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadMode, setUploadMode] = useState<'single' | 'multiple' | 'folder'>('single');
  const [processingProgress, setProcessingProgress] = useState<string>('');
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  
  // Progress tracking state
  const [progressData, setProgressData] = useState<{
    currentFile: string;
    currentIndex: number;
    totalFiles: number;
    processedFiles: number;
    failedFiles: number;
    stage: 'extracting' | 'analyzing' | 'complete';
    currentOperation?: string;
    details?: string[];
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Check if AI is available on mount
  useEffect(() => {
    fetch('/api/analyze')
      .then(res => res.json())
      .then(data => {
        setAiAvailable(data.aiAvailable);
        if (data.aiAvailable) {
          setUseAI(true);
        }
      })
      .catch(() => setAiAvailable(false));
  }, []);

  // Show help on first visit
  useEffect(() => {
    const hasSeenHelp = localStorage.getItem('filescope-help-seen');
    if (!hasSeenHelp) {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        setShowHelp(true);
        localStorage.setItem('filescope-help-seen', 'true');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ? key to open help
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const activeElement = document.activeElement;
        const isInputFocused = activeElement instanceof HTMLInputElement || 
                              activeElement instanceof HTMLTextAreaElement;
        if (!isInputFocused) {
          e.preventDefault();
          setShowHelp(true);
        }
      }
      // Escape to close modals
      if (e.key === 'Escape') {
        setShowHelp(false);
        setShowOptions(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Apply options and search to results
  // Apply options to single result
  const filteredAnalysis = useMemo(() => {
    if (!result?.analysis) return null;
    return applyOptions(result.analysis, options, searchQuery);
  }, [result?.analysis, options, searchQuery]);

  // Apply options to batch result
  const filteredBatchAnalysis = useMemo(() => {
    if (!batchResult?.combinedAnalysis) return null;
    return applyOptions(batchResult.combinedAnalysis, options, searchQuery);
  }, [batchResult?.combinedAnalysis, options, searchQuery]);

  const processFile = useCallback(async (file: File, withAI: boolean = useAI) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setUploadedFileName(file.name);
    setCurrentFile(file);
    setSearchQuery('');

    // Check file size (limit to 10MB for individual files)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum size is 10 MB.`);
      setIsLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('useAI', withAI.toString());
      
      // Send custom prefixes if any
      if (options.customPrefixes.length > 0) {
        formData.append('customPrefixes', JSON.stringify(options.customPrefixes));
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(
          text.includes('Request Entity Too Large') || text.includes('413')
            ? `File "${file.name}" is too large. Maximum size is approximately 10MB.`
            : text.includes('Request')
            ? `Server error: ${text.substring(0, 200)}`
            : 'Server returned an invalid response. Please try again.'
        );
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If JSON parsing fails, the response might be HTML or plain text
        const text = await response.text();
        throw new Error(
          text.includes('Request Entity Too Large') || text.includes('413')
            ? `File "${file.name}" is too large. Maximum size is approximately 10MB.`
            : text.includes('Request')
            ? `Server error: ${text.substring(0, 200)}`
            : 'Server returned an invalid response. Please try again.'
        );
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze document');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [useAI, options.customPrefixes]);

  // Process multiple files (batch)
  // Process files one by one with progress tracking
  const processFiles = useCallback(async (files: File[], withAI: boolean = useAI) => {
    // Filter valid files
    const validFiles = files.filter(f => {
      const ext = f.name.toLowerCase().split('.').pop();
      return ext === 'pdf' || ext === 'docx';
    });

    if (validFiles.length === 0) {
      setError('No valid files found. Please upload PDF or Word documents.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setBatchResult(null);
    setCurrentFiles(validFiles);
    setUploadedFileName(`${validFiles.length} files`);
    setSearchQuery('');

    // Initialize progress
    setProgressData({
      currentFile: validFiles[0].name,
      currentIndex: 0,
      totalFiles: validFiles.length,
      processedFiles: 0,
      failedFiles: 0,
      stage: 'extracting',
    });

    // For small batches, use individual processing with progress
    // For large batches (>10 files), use batch endpoint for efficiency
    if (validFiles.length <= 10) {
      const results: Array<{ fileName: string; success: boolean; error?: string; analysis?: AnalysisResult & { aiEnhanced?: boolean } }> = [];
      
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        
        // Update progress (with small delay to ensure UI updates)
        await new Promise(resolve => setTimeout(resolve, 50));
        
        setProgressData(prev => prev ? {
          ...prev,
          currentFile: file.name,
          currentIndex: i,
          stage: 'extracting',
          currentOperation: `Extracting text from ${file.name}...`,
          details: [
            `File ${i + 1} of ${validFiles.length}`,
            `Type: ${file.name.endsWith('.pdf') ? 'PDF' : 'Word Document'}`,
            `Size: ${(file.size / 1024).toFixed(1)} KB`,
          ],
        } : null);

        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('useAI', withAI.toString());

          const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData,
          });

          // Update to analyzing stage
          setProgressData(prev => prev ? {
            ...prev,
            stage: 'analyzing',
            currentOperation: withAI ? 'AI analyzing patterns...' : 'Detecting file name patterns...',
            details: [
              'Processing response from server...',
              withAI ? 'Using GPT-4o-mini for intelligent extraction' : 'Using regex pattern matching',
            ],
          } : null);

          // Check if response is JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(
              text.includes('Request Entity Too Large') || text.includes('413')
                ? `File "${file.name}" is too large. Maximum size is approximately 4.5MB.`
                : text.includes('Request')
                ? `Server error: ${text.substring(0, 200)}`
                : 'Server returned an invalid response. Please try again.'
            );
          }

          const data = await response.json();
          
          // Update with actual data
          setProgressData(prev => prev ? {
            ...prev,
            details: [
              `Text extracted: ${data.textLength || 0} characters`,
              withAI ? 'AI analysis complete' : 'Pattern detection complete',
            ],
          } : null);

          if (response.ok && data.analysis) {
            results.push({ fileName: file.name, success: true, analysis: { ...data.analysis, aiEnhanced: data.aiUsed } });
            setProgressData(prev => prev ? {
              ...prev,
              processedFiles: prev.processedFiles + 1,
              currentOperation: `Found ${data.analysis.totalFound} file names`,
              details: [
                `✓ ${file.name} processed successfully`,
                `Found ${data.analysis.totalFound} file names`,
                `${data.analysis.patterns.length} pattern groups identified`,
              ],
            } : null);
          } else {
            results.push({ fileName: file.name, success: false, error: data.error || 'Unknown error' });
            setProgressData(prev => prev ? {
              ...prev,
              failedFiles: prev.failedFiles + 1,
              currentOperation: `Failed to process ${file.name}`,
              details: [`✗ Error: ${data.error || 'Unknown error'}`],
            } : null);
          }
        } catch (err) {
          results.push({ fileName: file.name, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
          setProgressData(prev => prev ? { ...prev, failedFiles: prev.failedFiles + 1 } : null);
        }
      }

      // Update progress to complete
      setProgressData(prev => prev ? { ...prev, currentIndex: validFiles.length, stage: 'complete' } : null);

      // Merge results
      const successfulResults = results.filter(r => r.success && r.analysis);
      
      if (successfulResults.length === 0) {
        setError('All files failed to process.');
        setProgressData(null);
        setIsLoading(false);
        return;
      }

      // Combine analyses
      const allPatterns: Map<string, { files: PatternGroup['files']; description?: string }> = new Map();
      const allDuplicates: Set<string> = new Set();
      let aiEnhanced = false;

      for (const { analysis } of successfulResults) {
        if (!analysis) continue;
        if (analysis.aiEnhanced) aiEnhanced = true;

        for (const dup of analysis.duplicates) {
          allDuplicates.add(dup);
        }

        for (const pattern of analysis.patterns) {
          const existing = allPatterns.get(pattern.pattern);
          if (existing) {
            existing.files.push(...pattern.files);
          } else {
            allPatterns.set(pattern.pattern, {
              files: [...pattern.files],
              description: pattern.description,
            });
          }
        }
      }

      const patterns = Array.from(allPatterns.entries())
        .map(([pattern, data]) => ({
          pattern,
          files: data.files,
          count: data.files.length,
          description: data.description,
        }))
        .sort((a, b) => b.count - a.count);

      const totalFound = patterns.reduce((sum, p) => sum + p.count, 0);

      setBatchResult({
        success: true,
        totalFiles: validFiles.length,
        successfulFiles: successfulResults.length,
        failedFiles: results.filter(r => !r.success).length,
        results: results.map(r => ({
          fileName: r.fileName,
          fileType: r.fileName.split('.').pop() || 'unknown',
          success: r.success,
          error: r.error,
        })),
        combinedAnalysis: {
          totalFound,
          patterns,
          duplicates: Array.from(allDuplicates),
          aiEnhanced,
          sourceFiles: successfulResults.map(r => r.fileName),
        },
        aiAvailable: true,
        aiUsed: withAI && aiEnhanced,
      });

      // Small delay to show complete state
      setTimeout(() => {
        setProgressData(null);
        setIsLoading(false);
      }, 500);

    } else {
      // Use batch endpoint for large batches
      setProgressData(prev => prev ? { ...prev, stage: 'analyzing' } : null);

      try {
        const formData = new FormData();
        for (const file of validFiles) {
          formData.append('files', file);
        }
        formData.append('useAI', withAI.toString());

        const response = await fetch('/api/analyze-batch', {
          method: 'POST',
          body: formData,
        });

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          throw new Error(
            text.includes('Request Entity Too Large') || text.includes('413')
              ? 'Files are too large. Total size limit is approximately 10MB. Please upload fewer or smaller files.'
              : text.includes('Request')
              ? `Server error: ${text.substring(0, 200)}`
              : 'Server returned an invalid response. Please try again.'
          );
        }

        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          const text = await response.text();
          throw new Error(
            text.includes('Request Entity Too Large') || text.includes('413')
              ? 'Files are too large. Total size limit is approximately 10MB.'
              : 'Server returned an invalid response. Please try again.'
          );
        }

        if (!response.ok) {
          throw new Error(data.error || 'Failed to analyze documents');
        }

        setProgressData(prev => prev ? { ...prev, currentIndex: validFiles.length, stage: 'complete' } : null);
        
        setTimeout(() => {
          setBatchResult(data);
          setProgressData(null);
          setIsLoading(false);
        }, 500);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        setProgressData(null);
        setIsLoading(false);
      }
    }
  }, [useAI]);

  // Process ZIP file
  const processZipFile = useCallback(async (file: File, withAI: boolean = useAI) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setBatchResult(null);
    setUploadedFileName(file.name);

    setProgressData({
      currentFile: file.name,
      currentIndex: 0,
      totalFiles: 1,
      processedFiles: 0,
      failedFiles: 0,
      stage: 'extracting',
      currentOperation: 'Reading ZIP archive...',
      details: [`File size: ${(file.size / 1024 / 1024).toFixed(2)} MB`],
    });

    try {
      // First, extract the ZIP
      const formData = new FormData();
      formData.append('file', file);
      formData.append('includeSubfolders', includeSubfolders.toString());

      // Update progress before fetch
      setProgressData(prev => prev ? {
        ...prev,
        currentOperation: 'Uploading ZIP to server...',
        details: [`File size: ${(file.size / 1024 / 1024).toFixed(2)} MB`, 'Preparing for extraction...'],
      } : null);

      const extractResponse = await fetch('/api/extract-zip', {
        method: 'POST',
        body: formData,
      });

      setProgressData(prev => prev ? {
        ...prev,
        currentOperation: 'Server processing ZIP archive...',
        details: ['Scanning archive structure...', 'Identifying supported files...'],
      } : null);

      // Check if response is JSON
      const contentType = extractResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await extractResponse.text();
        throw new Error(
          text.includes('Request Entity Too Large') || text.includes('413')
            ? 'File is too large. Please try a smaller ZIP file or split it into multiple archives.'
            : text.includes('Request')
            ? `Server error: ${text.substring(0, 200)}`
            : 'Server returned an invalid response. Please try again.'
        );
      }

      const extractData = await extractResponse.json();

      if (!extractResponse.ok) {
        throw new Error(extractData.error || 'Failed to extract ZIP file');
      }

      const totalFiles = extractData.files?.length || 0;
      
      setProgressData(prev => prev ? {
        ...prev,
        currentOperation: `Found ${totalFiles} files. Converting to processable format...`,
        totalFiles: totalFiles,
        details: [`Extracted ${totalFiles} PDF/Word documents`, 'Converting base64 data to files...'],
      } : null);

      // Convert extracted files to File objects with progress updates
      const extractedFiles: File[] = [];
      
      for (let i = 0; i < extractData.files.length; i++) {
        const extractedFile = extractData.files[i];
        
        // Update progress during conversion (with small delay to ensure UI updates)
        await new Promise(resolve => setTimeout(resolve, 10));
        
        setProgressData(prev => prev ? {
          ...prev,
          currentFile: extractedFile.name,
          currentIndex: i,
          currentOperation: `Converting file ${i + 1}/${totalFiles}...`,
          details: [
            `Processing: ${extractedFile.name}`,
            `Progress: ${i + 1} of ${totalFiles} files converted`,
            `Size: ${(extractedFile.size / 1024).toFixed(1)} KB`,
          ],
        } : null);
        
        // Decode base64 to array buffer
        const binaryString = atob(extractedFile.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }
        
        // Determine MIME type
        const ext = extractedFile.name.toLowerCase().split('.').pop();
        const mimeType = ext === 'pdf' 
          ? 'application/pdf' 
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        
        const blob = new Blob([bytes], { type: mimeType });
        const fileObj = new File([blob], extractedFile.name, { type: mimeType });
        extractedFiles.push(fileObj);
      }

      // Update progress
      setProgressData({
        currentFile: extractedFiles[0]?.name || 'Starting analysis...',
        currentIndex: 0,
        totalFiles: extractedFiles.length,
        processedFiles: 0,
        failedFiles: 0,
        stage: 'analyzing',
        currentOperation: 'Ready to analyze extracted files',
        details: [
          `Successfully extracted ${extractedFiles.length} files`,
          'Starting document analysis...',
        ],
      });

      // Now process the extracted files
      setCurrentFiles(extractedFiles);
      setUploadedFileName(`${file.name} (${extractedFiles.length} files)`);
      
      // Continue with regular file processing
      await processFiles(extractedFiles, withAI);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process ZIP file');
      setProgressData(null);
      setIsLoading(false);
    }
  }, [useAI, includeSubfolders, processFiles]);

  // Handle ZIP file selection
  const handleZipSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processZipFile(file);
    }
  }, [processZipFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    
    if (files.length === 0) return;
    
    if (files.length === 1) {
      const file = files[0];
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'zip') {
        // Handle ZIP file
        processZipFile(file);
      } else if (ext === 'pdf' || ext === 'docx') {
        processFile(file);
      } else {
        setError('Please upload a PDF, Word document (.docx), or ZIP file');
      }
    } else {
      // Multiple files dropped
      processFiles(files);
    }
  }, [processFile, processFiles, processZipFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;
    
    if (files.length === 1) {
      processFile(files[0]);
    } else {
      processFiles(files);
    }
  }, [processFile, processFiles]);

  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;
    
    // Filter for PDF and DOCX files
    const validFiles = files.filter(f => {
      const ext = f.name.toLowerCase().split('.').pop();
      return ext === 'pdf' || ext === 'docx';
    });

    if (validFiles.length === 0) {
      setError('No PDF or Word documents found in the selected folder.');
      return;
    }

    processFiles(validFiles);
  }, [processFiles]);

  const handleReanalyze = useCallback(() => {
    if (currentFile) {
      processFile(currentFile, !result?.aiUsed);
    }
  }, [currentFile, processFile, result?.aiUsed]);

  // Generate CSV content from analysis data
  const generateCSV = useCallback((analysis: AnalysisResult, sourceInfo: string) => {
    const rows = [['File Name', 'Extension', 'Pattern Group', 'Confidence', 'Is Duplicate', 'Source']];
    
    for (const group of analysis.patterns) {
      for (const file of group.files) {
        rows.push([
          file.name,
          file.extension,
          group.pattern,
          file.confidence ? String(Math.round(Number(file.confidence) * 100)) + '%' : '',
          analysis.duplicates.includes(file.name) ? 'Yes' : 'No',
          sourceInfo
        ]);
      }
    }
    
    const csvContent = rows.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `file-analysis-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, []);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportMenu2, setShowExportMenu2] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef2 = useRef<HTMLDivElement>(null);

  const handleExportCSV = useCallback(() => {
    if (result && filteredAnalysis) {
      generateCSV(filteredAnalysis, currentFile?.name || 'Unknown');
    } else if (batchResult && filteredBatchAnalysis) {
      generateCSV(filteredBatchAnalysis, `Batch (${batchResult.successfulFiles} files)`);
    }
    setShowExportMenu(false);
  }, [result, filteredAnalysis, batchResult, filteredBatchAnalysis, currentFile, generateCSV]);

  const handleExportJSON = useCallback(() => {
    const analysis = result && filteredAnalysis ? filteredAnalysis : (batchResult && filteredBatchAnalysis ? filteredBatchAnalysis : null);
    const sourceInfo = result ? (currentFile?.name || 'Unknown') : (batchResult ? `Batch (${batchResult.successfulFiles} files)` : 'Unknown');
    
    if (analysis) {
      const jsonContent = exportToJSON(analysis, sourceInfo);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      downloadFile(blob, `file-analysis-${Date.now()}.json`);
    }
    setShowExportMenu(false);
    setShowExportMenu2(false);
  }, [result, filteredAnalysis, batchResult, filteredBatchAnalysis, currentFile]);

  const handleExportExcel = useCallback(() => {
    const analysis = result && filteredAnalysis ? filteredAnalysis : (batchResult && filteredBatchAnalysis ? filteredBatchAnalysis : null);
    const sourceInfo = result ? (currentFile?.name || 'Unknown') : (batchResult ? `Batch (${batchResult.successfulFiles} files)` : 'Unknown');
    
    if (analysis) {
      const blob = exportToExcel(analysis, sourceInfo);
      downloadFile(blob, `file-analysis-${Date.now()}.xlsx`);
    }
    setShowExportMenu(false);
    setShowExportMenu2(false);
  }, [result, filteredAnalysis, batchResult, filteredBatchAnalysis, currentFile]);

  const handleExportMarkdown = useCallback(() => {
    const analysis = result && filteredAnalysis ? filteredAnalysis : (batchResult && filteredBatchAnalysis ? filteredBatchAnalysis : null);
    const sourceInfo = result ? (currentFile?.name || 'Unknown') : (batchResult ? `Batch (${batchResult.successfulFiles} files)` : 'Unknown');
    
    if (analysis) {
      const markdownContent = exportToMarkdown(analysis, sourceInfo);
      const blob = new Blob([markdownContent], { type: 'text/markdown' });
      downloadFile(blob, `file-analysis-${Date.now()}.md`);
    }
    setShowExportMenu(false);
    setShowExportMenu2(false);
  }, [result, filteredAnalysis, batchResult, filteredBatchAnalysis, currentFile]);

  // Close export menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
      if (exportMenuRef2.current && !exportMenuRef2.current.contains(event.target as Node)) {
        setShowExportMenu2(false);
      }
    };

    if (showExportMenu || showExportMenu2) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu, showExportMenu2]);

  const handleReset = useCallback(() => {
    setResult(null);
    setBatchResult(null);
    setError(null);
    setUploadedFileName(null);
    setCurrentFile(null);
    setCurrentFiles([]);
    setSearchQuery('');
    setProcessingProgress('');
    setProgressData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
    if (zipInputRef.current) {
      zipInputRef.current.value = '';
    }
  }, []);

  // Count active options
  const activeOptionsCount = useMemo(() => {
    let count = 0;
    if (options.extensionFilter.length > 0) count++;
    if (options.minGroupSize !== DEFAULT_OPTIONS.minGroupSize) count++;
    if (options.confidenceThreshold !== DEFAULT_OPTIONS.confidenceThreshold) count++;
    if (options.sortBy !== DEFAULT_OPTIONS.sortBy || options.sortOrder !== DEFAULT_OPTIONS.sortOrder) count++;
    if (options.showLineNumbers) count++;
    if (options.duplicateHandling !== DEFAULT_OPTIONS.duplicateHandling) count++;
    if (options.customPrefixes.length > 0) count++;
    if (options.caseSensitive) count++;
    return count;
  }, [options]);

  return (
    <main className="min-h-screen bg-grid-pattern">
      {/* Options Panel */}
      <OptionsPanel
        options={options}
        onChange={setOptions}
        aiAvailable={aiAvailable}
        isOpen={showOptions}
        onClose={() => setShowOptions(false)}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />

      {/* Header */}
      <header className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#00d9ff] via-[#a855f7] to-[#ec4899] flex items-center justify-center shadow-lg shadow-purple-500/30">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">FileScope</h1>
              <p className="text-xs text-[var(--text-muted)]">AI-Powered Document Analyzer</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Help Button */}
            <Tooltip content="How to use (press ?)">
              <button 
                onClick={() => setShowHelp(true)}
                className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-emerald-500 hover:text-emerald-500 transition-colors"
                aria-label="Help"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </button>
            </Tooltip>

            {/* Options Button */}
            <Tooltip content="Analysis options">
              <button 
                onClick={() => setShowOptions(true)}
                className="relative p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--accent-primary)] transition-colors"
                aria-label="Options"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                {activeOptionsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--accent-primary)] text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {activeOptionsCount}
                  </span>
                )}
              </button>
            </Tooltip>

            {!isLoading && !result && (
              <AIToggle 
                enabled={useAI} 
                onChange={setUseAI} 
                available={aiAvailable}
              />
            )}
            {result && (
              <button onClick={handleReset} className="btn-secondary text-sm">
                ← New
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Upload Section */}
        {!result && !isLoading && (
          <div className="animate-slide-up opacity-0" style={{ animationDelay: '0.1s' }}>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-3">
                Extract & Analyze <span className="gradient-text">File Names</span>
              </h2>
              <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">
                Upload a PDF or Word document containing file lists. 
                {useAI && aiAvailable ? (
                  <span className="text-[var(--accent-primary)]"> AI will intelligently extract and categorize file names.</span>
                ) : (
                  ' We\'ll extract all file names and group them by naming patterns automatically.'
                )}
              </p>
            </div>

            {/* Active Options Preview */}
            {activeOptionsCount > 0 && (
              <div className="flex justify-center mb-4 animate-fade-in">
                <button 
                  onClick={() => setShowOptions(true)}
                  className="glass-card px-4 py-2 flex items-center gap-2 text-sm hover:border-[var(--accent-primary)] transition-colors cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--accent-primary)]">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  <span className="text-[var(--text-secondary)]">{activeOptionsCount} filter{activeOptionsCount !== 1 ? 's' : ''} active</span>
                  <span className="text-[var(--text-muted)]">· Click to edit</span>
                </button>
              </div>
            )}

            {/* AI Feature Badge */}
            {useAI && aiAvailable && (
              <div className="flex justify-center mb-6 animate-slide-up opacity-0" style={{ animationDelay: '0.15s' }}>
                <div className="glass-card px-4 py-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">AI-Enhanced Analysis</p>
                    <p className="text-xs text-[var(--text-muted)]">GPT-4o-mini powered extraction</p>
                  </div>
                </div>
              </div>
            )}

            <div
              className={`drop-zone glass-card p-12 text-center cursor-pointer ${isDragging ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                onChange={handleFolderSelect}
                className="hidden"
              />
              
              <div className="mb-6">
                <div className={`upload-icon-container w-24 h-24 mx-auto rounded-3xl flex items-center justify-center ${isDragging ? 'animate-pulse-glow animate-float' : ''}`}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="url(#uploadGradient)" strokeWidth="1.5">
                    <defs>
                      <linearGradient id="uploadGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00d9ff" />
                        <stop offset="50%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
              </div>
              
              <p className="text-lg font-medium text-[var(--text-primary)] mb-2">
                {isDragging ? 'Drop your files here' : 'Drag & drop files or folders here'}
              </p>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                Supports single files, multiple files, or entire folders
              </p>
              
              {/* Upload mode buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#00d9ff] to-[#0099ff] text-white rounded-xl font-medium shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all hover:-translate-y-0.5"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Select Files
                </button>
                
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#a855f7] to-[#ec4899] text-white rounded-xl font-medium shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all hover:-translate-y-0.5"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  Select Folder
                </button>
                
                <button
                  onClick={() => zipInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#f59e0b] to-[#ef4444] text-white rounded-xl font-medium shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all hover:-translate-y-0.5"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 8v13H3V8" />
                    <path d="M1 3h22v5H1z" />
                    <path d="M10 12h4" />
                  </svg>
                  Upload ZIP
                </button>
                
                {/* Hidden ZIP input */}
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleZipSelect}
                  className="hidden"
                />
              </div>
              
              {/* Subfolder toggle */}
              <div className="flex items-center justify-center gap-3 mt-4 p-3 bg-[var(--bg-secondary)] rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div 
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      includeSubfolders 
                        ? 'bg-gradient-to-r from-[#a855f7] to-[#ec4899]' 
                        : 'bg-[var(--border-color)]'
                    }`}
                    onClick={() => setIncludeSubfolders(!includeSubfolders)}
                  >
                    <div 
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${
                        includeSubfolders ? 'translate-x-6' : 'translate-x-1'
                      }`} 
                    />
                  </div>
                  <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    Include subfolders
                  </span>
                </label>
                <Tooltip content="When enabled, scans nested folders inside ZIP files and folder selections">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" className="cursor-help">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </Tooltip>
              </div>
              
              <div className="flex items-center justify-center gap-4 mt-4">
                <span className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="ext-badge ext-pdf">PDF</span>
                  PDF
                </span>
                <span className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="ext-badge ext-docx">DOCX</span>
                  Word
                </span>
                <span className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-gradient-to-r from-[#f59e0b] to-[#ef4444] text-white">ZIP</span>
                  Archive
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          progressData ? (
            <ProgressIndicator {...progressData} />
          ) : (
            <div className="glass-card p-16 text-center animate-fade-in">
              <div className="loading-spinner mx-auto mb-6"></div>
              <p className="text-lg font-medium text-[var(--text-primary)] mb-2">
                {currentFiles.length > 1 
                  ? `Processing ${currentFiles.length} files...`
                  : useAI ? 'AI is analyzing your document...' : 'Analyzing document...'}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {processingProgress || (useAI 
                  ? 'Extracting and categorizing file names with GPT-4o-mini' 
                  : `Extracting text from ${uploadedFileName}`)}
              </p>
            </div>
          )
        )}

        {/* Error State */}
        {error && (
          <div className="error-message animate-slide-up mb-6">
            <div className="flex items-start gap-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--error)] shrink-0 mt-0.5">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-medium mb-1">Analysis Failed</p>
                <p className="text-sm opacity-80">{error}</p>
              </div>
            </div>
            <button 
              onClick={handleReset}
              className="btn-secondary mt-4 text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Batch Results */}
        {batchResult && filteredBatchAnalysis && (
          <div className="space-y-6">
            {/* Batch Summary Card */}
            <div className="glass-card p-5 animate-slide-up opacity-0 border-l-4 border-gradient-to-b from-cyan-500 to-purple-500" style={{ animationDelay: '0.02s', borderLeftColor: '#00d9ff' }}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d9ff] to-[#a855f7] flex items-center justify-center shrink-0 shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-lg text-[var(--text-primary)]">Batch Analysis Complete</span>
                    {batchResult.aiUsed && (
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">AI Enhanced</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-[var(--text-secondary)]">
                      <span className="text-[#10b981] font-bold">{batchResult.successfulFiles}</span> successful
                    </span>
                    {batchResult.failedFiles > 0 && (
                      <span className="text-[var(--text-secondary)]">
                        <span className="text-[#ef4444] font-bold">{batchResult.failedFiles}</span> failed
                      </span>
                    )}
                    <span className="text-[var(--text-secondary)]">
                      <span className="text-[var(--accent-primary)] font-bold">{batchResult.totalFiles}</span> total files
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Source files list */}
              {batchResult.combinedAnalysis.sourceFiles && batchResult.combinedAnalysis.sourceFiles.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                  <p className="text-xs text-[var(--text-muted)] mb-2">Processed files:</p>
                  <div className="flex flex-wrap gap-2">
                    {batchResult.combinedAnalysis.sourceFiles.slice(0, 10).map((file, i) => (
                      <span key={i} className="text-xs bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-secondary)]">
                        {file}
                      </span>
                    ))}
                    {batchResult.combinedAnalysis.sourceFiles.length > 10 && (
                      <span className="text-xs bg-[var(--bg-secondary)] px-2 py-1 rounded text-[var(--text-muted)]">
                        +{batchResult.combinedAnalysis.sourceFiles.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Failed files */}
              {batchResult.failedFiles > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                  <p className="text-xs text-[#ef4444] mb-2">Failed files:</p>
                  <div className="space-y-1">
                    {batchResult.results.filter(r => !r.success).map((r, i) => (
                      <div key={i} className="text-xs text-[var(--text-secondary)]">
                        <span className="font-medium">{r.fileName}:</span> {r.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-up opacity-0" style={{ animationDelay: '0.05s' }}>
              <div className="stat-card">
                <div className="stat-number">{batchResult.totalFiles}</div>
                <div className="stat-label">Files Processed</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{filteredBatchAnalysis.totalFound}</div>
                <div className="stat-label">File Names Found</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{filteredBatchAnalysis.patterns.length}</div>
                <div className="stat-label">Pattern Groups</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{batchResult.combinedAnalysis.duplicates.length}</div>
                <div className="stat-label">Duplicates</div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="glass-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-slide-up opacity-0" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-3 flex-1">
                <SearchFilter
                  onSearch={setSearchQuery}
                  placeholder="Search all files..."
                  totalResults={batchResult.combinedAnalysis.totalFound}
                  filteredResults={filteredBatchAnalysis.totalFound}
                />
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowOptions(true)}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  Filter
                </button>
                <div className="relative" ref={exportMenuRef}>
                  <button 
                    onClick={() => setShowExportMenu(!showExportMenu)} 
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl z-50 overflow-hidden">
                      <button
                        onClick={handleExportCSV}
                        className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        CSV
                      </button>
                      <button
                        onClick={handleExportJSON}
                        className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 7V4h16v3M9 20h6M12 4v16m-8 0h16" />
                        </svg>
                        JSON
                      </button>
                      <button
                        onClick={handleExportExcel}
                        className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <line x1="3" y1="9" x2="21" y2="9" />
                          <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                        Excel
                      </button>
                      <button
                        onClick={handleExportMarkdown}
                        className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                        Markdown
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={handleReset} className="btn-secondary text-sm flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  New Analysis
                </button>
              </div>
            </div>

            {/* Pattern Groups */}
            {filteredBatchAnalysis.totalFound === 0 ? (
              <div className="empty-state glass-card animate-slide-up opacity-0" style={{ animationDelay: '0.15s' }}>
                <div className="empty-icon">{searchQuery ? '🔍' : '📭'}</div>
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                  {searchQuery ? 'No Matching Files' : 'No File Names Found'}
                </h3>
                <p className="text-[var(--text-secondary)] max-w-md mx-auto">
                  {searchQuery 
                    ? `No files match "${searchQuery}".`
                    : 'No file names were found in the processed documents.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] animate-slide-up opacity-0 flex items-center justify-between" style={{ animationDelay: '0.15s' }}>
                  <span>Combined Pattern Groups</span>
                  <span className="text-sm font-normal text-[var(--text-muted)]">
                    {filteredBatchAnalysis.totalFound} files from {batchResult.successfulFiles} documents
                  </span>
                </h3>
                {filteredBatchAnalysis.patterns.map((group, index) => (
                  <PatternGroupCard 
                    key={index} 
                    group={group} 
                    index={index}
                    duplicates={batchResult.combinedAnalysis.duplicates}
                    aiEnhanced={batchResult.combinedAnalysis.aiEnhanced}
                    options={options}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Single File Results */}
        {result && filteredAnalysis && (
          <div className="space-y-6">
            {/* AI Badge if used */}
            {result.aiUsed && result.analysis.aiEnhanced && (
              <div className="glass-card p-4 animate-slide-up opacity-0 border-l-4 border-purple-500" style={{ animationDelay: '0.02s' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[var(--text-primary)]">AI Analysis Complete</span>
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">GPT-4o-mini</span>
                    </div>
                    {result.analysis.documentType && (
                      <p className="text-sm text-[var(--text-secondary)] mb-1">
                        <span className="text-[var(--text-muted)]">Document Type:</span> {result.analysis.documentType}
                      </p>
                    )}
                    {result.analysis.summary && (
                      <p className="text-sm text-[var(--text-muted)]">{result.analysis.summary}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up opacity-0" style={{ animationDelay: '0.05s' }}>
              <div className="stat-card">
                <div className="stat-number">{filteredAnalysis.totalFound}</div>
                <div className="stat-label">
                  {filteredAnalysis.totalFound !== result.analysis.totalFound 
                    ? `of ${result.analysis.totalFound} Files` 
                    : 'Files Found'
                  }
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{filteredAnalysis.patterns.length}</div>
                <div className="stat-label">Pattern Groups</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{result.analysis.duplicates.length}</div>
                <div className="stat-label">Duplicates</div>
              </div>
            </div>

            {/* Source Info + Search */}
            <div className="glass-card p-4 animate-slide-up opacity-0" style={{ animationDelay: '0.1s' }}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--accent-primary)]">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{result.fileName}</p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {result.pageCount ? `${result.pageCount} pages · ` : ''}
                      {(result.textLength / 1000).toFixed(1)}k chars
                      {result.aiUsed ? ' · AI' : ' · Regex'}
          </p>
        </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 lg:flex-initial lg:max-w-xl">
                  <div className="flex-1">
                    <SearchFilter
                      onSearch={setSearchQuery}
                      placeholder="Search files..."
                      totalResults={result.analysis.totalFound}
                      filteredResults={filteredAnalysis.totalFound}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowOptions(true)}
                      className="btn-secondary text-sm flex items-center gap-2 relative"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                      </svg>
                      Filter
                      {activeOptionsCount > 0 && (
                        <span className="w-5 h-5 bg-[var(--accent-primary)] text-white text-xs rounded-full flex items-center justify-center font-bold">
                          {activeOptionsCount}
                        </span>
                      )}
                    </button>
                    
                    {aiAvailable && (
                      <button 
                        onClick={handleReanalyze}
                        className="btn-secondary text-sm flex items-center gap-2"
                        title={result.aiUsed ? 'Re-analyze with regex' : 'Re-analyze with AI'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 4v6h6" />
                          <path d="M23 20v-6h-6" />
                          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                        </svg>
                        {result.aiUsed ? 'Regex' : 'AI'}
                      </button>
                    )}
                    
                    <div className="relative" ref={exportMenuRef2}>
                      <button 
                        onClick={() => setShowExportMenu2(!showExportMenu2)} 
                        className="btn-primary text-sm flex items-center gap-2"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {showExportMenu2 && (
                        <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl z-50 overflow-hidden">
                          <button
                            onClick={handleExportCSV}
                            className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            CSV
                          </button>
                          <button
                            onClick={handleExportJSON}
                            className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 7V4h16v3M9 20h6M12 4v16m-8 0h16" />
                            </svg>
                            JSON
                          </button>
                          <button
                            onClick={handleExportExcel}
                            className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <line x1="3" y1="9" x2="21" y2="9" />
                              <line x1="9" y1="21" x2="9" y2="9" />
                            </svg>
                            Excel
                          </button>
                          <button
                            onClick={handleExportMarkdown}
                            className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center gap-2 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                              <polyline points="10 9 9 9 8 9" />
                            </svg>
                            Markdown
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Results or Empty State */}
            {filteredAnalysis.totalFound === 0 ? (
              <div className="empty-state glass-card animate-slide-up opacity-0" style={{ animationDelay: '0.15s' }}>
                <div className="empty-icon">
                  {searchQuery ? '🔍' : '📭'}
                </div>
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                  {searchQuery ? 'No Matching Files' : 'No File Names Found'}
                </h3>
                <p className="text-[var(--text-secondary)] max-w-md mx-auto">
                  {searchQuery ? (
                    <>No files match &quot;{searchQuery}&quot;. Try a different search term.</>
                  ) : (
                    'We couldn\'t detect any file names in this document. Try adjusting filters or using AI analysis.'
                  )}
                </p>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="btn-secondary mt-4"
                  >
                    Clear Search
                  </button>
                )}
                {!searchQuery && !result.aiUsed && aiAvailable && (
                  <button 
                    onClick={handleReanalyze}
                    className="btn-primary mt-4"
                  >
                    Try with AI Analysis
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] animate-slide-up opacity-0 flex items-center justify-between" style={{ animationDelay: '0.15s' }}>
                  <span>Pattern Groups</span>
                  {(searchQuery || activeOptionsCount > 0) && (
                    <span className="text-sm font-normal text-[var(--text-muted)]">
                      Showing {filteredAnalysis.totalFound} of {result.analysis.totalFound} files
                    </span>
                  )}
                </h3>
                {filteredAnalysis.patterns.map((group, index) => (
                  <PatternGroupCard 
                    key={index} 
                    group={group} 
                    index={index}
                    duplicates={result.analysis.duplicates}
                    aiEnhanced={result.analysis.aiEnhanced}
                    options={options}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color)] mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between text-sm text-[var(--text-muted)]">
          <span>FileScope · AI-Powered Document Analyzer</span>
          <button 
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 hover:text-[var(--accent-primary)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Help & Guide
          </button>
        </div>
      </footer>
      </main>
  );
}
