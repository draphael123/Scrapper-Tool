'use client';

import React from 'react';

interface ProgressIndicatorProps {
  currentFile: string;
  currentIndex: number;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  stage: 'extracting' | 'analyzing' | 'complete';
  currentOperation?: string;
  details?: string[];
}

export default function ProgressIndicator({
  currentFile,
  currentIndex,
  totalFiles,
  processedFiles,
  failedFiles,
  stage,
  currentOperation,
  details = [],
}: ProgressIndicatorProps) {
  const progress = totalFiles > 0 ? ((currentIndex + (stage === 'complete' ? 1 : 0)) / totalFiles) * 100 : 0;

  const stageLabels = {
    extracting: 'Extracting text',
    analyzing: 'Analyzing patterns',
    complete: 'Complete',
  };

  const stageIcons = {
    extracting: (
      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
    ),
    analyzing: (
      <svg className="animate-pulse" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    complete: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  };

  return (
    <div className="glass-card p-6 animate-fade-in">
      {/* Progress Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d9ff] to-[#a855f7] flex items-center justify-center text-white">
            {stageIcons[stage]}
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">
              Processing Files
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              {stageLabels[stage]}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold bg-gradient-to-r from-[#00d9ff] to-[#a855f7] text-transparent bg-clip-text">
            {currentIndex}
          </span>
          <span className="text-[var(--text-muted)]"> / {totalFiles}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-3 bg-[var(--bg-secondary)] rounded-full overflow-hidden mb-4">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#00d9ff] via-[#a855f7] to-[#ec4899] transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-white/30 to-transparent transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Current File */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 text-sm mb-2">
          <span className="text-[var(--text-muted)] shrink-0">Current:</span>
          <span className="text-[var(--text-primary)] font-medium truncate flex-1" title={currentFile}>
            {currentFile || 'Preparing...'}
          </span>
        </div>
        {currentOperation && (
          <div className="flex items-center gap-2 text-xs mt-2 pt-2 border-t border-[var(--bg-primary)]/20">
            <span className="text-[var(--text-muted)] shrink-0">Operation:</span>
            <span className="text-[var(--accent-primary)] font-medium truncate flex-1">
              {currentOperation}
            </span>
          </div>
        )}
        {details.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[var(--bg-primary)]/20 space-y-1">
            {details.map((detail, idx) => (
              <div key={idx} className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] shrink-0" />
                <span className="truncate">{detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 rounded-lg bg-[var(--bg-secondary)]">
          <div className="text-lg font-bold text-[#10b981]">{processedFiles}</div>
          <div className="text-xs text-[var(--text-muted)]">Processed</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-[var(--bg-secondary)]">
          <div className="text-lg font-bold text-[var(--accent-primary)]">{totalFiles - currentIndex}</div>
          <div className="text-xs text-[var(--text-muted)]">Remaining</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-[var(--bg-secondary)]">
          <div className="text-lg font-bold text-[#ef4444]">{failedFiles}</div>
          <div className="text-xs text-[var(--text-muted)]">Failed</div>
        </div>
      </div>

      {/* Activity indicator - pulse animation when processing */}
      {stage !== 'complete' && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#00d9ff] animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-[#a855f7] animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-[#ec4899] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-[var(--text-muted)] animate-pulse">
            Processing...
          </span>
        </div>
      )}
      
      {/* Completion indicator */}
      {stage === 'complete' && (
        <div className="mt-4 flex items-center justify-center gap-2 text-[#10b981]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-sm font-medium">Processing Complete!</span>
        </div>
      )}
    </div>
  );
}

