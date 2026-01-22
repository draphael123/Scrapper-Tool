'use client';

import { useState } from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'quickstart' | 'features' | 'patterns' | 'tips' | 'faq';

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'quickstart', label: 'Quick Start', icon: '🚀' },
  { id: 'features', label: 'Features', icon: '✨' },
  { id: 'patterns', label: 'Pattern Matching', icon: '🎯' },
  { id: 'tips', label: 'Tips', icon: '💡' },
  { id: 'faq', label: 'FAQ', icon: '❓' },
];

const stepGradients = [
  'from-[#00d9ff] to-[#0099ff]',
  'from-[#a855f7] to-[#ec4899]',
  'from-[#10b981] to-[#14b8a6]',
];

function StepCard({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="flex gap-4 p-5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] hover:border-[var(--accent-primary)]/50 transition-all">
      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${stepGradients[step - 1] || stepGradients[0]} flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg`}>
        {step}
      </div>
      <div>
        <h4 className="font-semibold text-[var(--text-primary)] mb-1 text-lg">{title}</h4>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

const featureColors = [
  { bg: 'from-[#00d9ff]/20 to-[#0099ff]/10', border: 'hover:border-[#00d9ff]', shadow: 'hover:shadow-[#00d9ff]/20' },
  { bg: 'from-[#a855f7]/20 to-[#6366f1]/10', border: 'hover:border-[#a855f7]', shadow: 'hover:shadow-[#a855f7]/20' },
  { bg: 'from-[#10b981]/20 to-[#14b8a6]/10', border: 'hover:border-[#10b981]', shadow: 'hover:shadow-[#10b981]/20' },
  { bg: 'from-[#f97316]/20 to-[#fbbf24]/10', border: 'hover:border-[#f97316]', shadow: 'hover:shadow-[#f97316]/20' },
  { bg: 'from-[#ec4899]/20 to-[#f43f5e]/10', border: 'hover:border-[#ec4899]', shadow: 'hover:shadow-[#ec4899]/20' },
  { bg: 'from-[#06b6d4]/20 to-[#3b82f6]/10', border: 'hover:border-[#06b6d4]', shadow: 'hover:shadow-[#06b6d4]/20' },
];

function FeatureCard({ icon, title, description, index = 0 }: { icon: React.ReactNode; title: string; description: string; index?: number }) {
  const colors = featureColors[index % featureColors.length];
  return (
    <div className={`p-5 bg-gradient-to-br ${colors.bg} rounded-xl border border-[var(--border-color)] ${colors.border} transition-all hover:shadow-lg ${colors.shadow} hover:-translate-y-1`}>
      <div className="w-12 h-12 rounded-xl bg-[var(--bg-card)] flex items-center justify-center mb-4 shadow-inner">
        {icon}
      </div>
      <h4 className="font-semibold text-[var(--text-primary)] mb-2">{title}</h4>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--bg-card-hover)] transition-colors"
      >
        <span className="font-medium text-[var(--text-primary)]">{question}</span>
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className={`text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-sm text-[var(--text-secondary)] animate-fade-in">
          {answer}
        </div>
      )}
    </div>
  );
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('quickstart');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative glass-card w-full max-w-3xl max-h-[90vh] overflow-hidden animate-slide-up m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">How to Use FileScope</h2>
              <p className="text-xs text-[var(--text-muted)]">Learn how to extract and analyze file names</p>
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

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-color)] px-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Quick Start Tab */}
          {activeTab === 'quickstart' && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Get Started in 3 Easy Steps</h3>
                <p className="text-[var(--text-secondary)]">Extract file names from your documents in seconds</p>
              </div>

              <StepCard 
                step={1}
                title="Upload Your Files"
                description="Drag and drop files, select multiple documents, choose a folder, or upload a ZIP archive. Supports PDF, Word (.docx), and ZIP files containing documents. Toggle 'Include subfolders' to scan nested directories."
              />

              <StepCard 
                step={2}
                title="Choose Analysis Mode"
                description="Toggle AI mode ON for intelligent extraction with context understanding, or keep it OFF for fast regex-based pattern matching. AI mode provides confidence scores and document type detection."
              />

              <StepCard 
                step={3}
                title="Review & Export Results"
                description="View extracted file names grouped by pattern across all documents. Use search and filters to find specific files. Export combined results to CSV for further processing."
              />

              <div className="mt-6 p-4 bg-gradient-to-r from-[var(--accent-primary)]/10 to-[var(--accent-secondary)]/10 rounded-xl border border-[var(--accent-primary)]/30">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div>
                    <h4 className="font-semibold text-[var(--text-primary)] mb-1">Pro Tip</h4>
                    <p className="text-sm text-[var(--text-secondary)]">
                      For best results, ensure your document has clear file names with extensions. 
                      AI mode works best for documents with complex formatting or unusual file naming conventions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Features Tab */}
          {activeTab === 'features' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Key Features</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FeatureCard
                  index={0}
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00d9ff" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  }
                  title="Batch & Folder Processing"
                  description="Upload multiple files, select entire folders, or upload ZIP archives. All results are combined into one unified view."
                />

                <FeatureCard
                  index={1}
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  }
                  title="AI-Powered Analysis"
                  description="GPT-4o-mini understands context to find file names regex might miss, with confidence scores."
                />

                <FeatureCard
                  index={2}
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  }
                  title="Smart Pattern Grouping"
                  description="Automatically groups files by naming convention, identifying common prefixes and patterns."
                />

                <FeatureCard
                  index={3}
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
                      <path d="M21 8v13H3V8" />
                      <path d="M1 3h22v5H1z" />
                      <path d="M10 12h4" />
                    </svg>
                  }
                  title="ZIP Archive Support"
                  description="Upload ZIP files containing PDFs and Word documents. Toggle subfolder scanning for nested archives."
                />

                <FeatureCard
                  index={4}
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                      <polyline points="13 2 13 9 20 9" />
                    </svg>
                  }
                  title="Live Progress Tracking"
                  description="Watch real-time progress as files are processed. See current file, success/failure counts, and stage."
                />

                <FeatureCard
                  index={5}
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  }
                  title="CSV Export"
                  description="Export all combined results to CSV format for use in Excel, Google Sheets, or data analysis tools."
                />
              </div>
            </div>
          )}

          {/* Pattern Matching Tab */}
          {activeTab === 'patterns' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Understanding Pattern Matching</h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-[var(--bg-secondary)] rounded-xl">
                  <h4 className="font-semibold text-[var(--text-primary)] mb-3">How Patterns Work</h4>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    FileScope identifies the static and variable parts of file names to group similar files together. 
                    Variable parts (numbers, dates, letters) are replaced with placeholders.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <code className="bg-[var(--bg-card)] px-2 py-1 rounded text-[var(--text-primary)]">Invoice_001.pdf</code>
                      <span className="text-[var(--text-muted)]">→</span>
                      <code className="bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] px-2 py-1 rounded">Invoice_XXX.pdf</code>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <code className="bg-[var(--bg-card)] px-2 py-1 rounded text-[var(--text-primary)]">Report-2024-01-15.xlsx</code>
                      <span className="text-[var(--text-muted)]">→</span>
                      <code className="bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] px-2 py-1 rounded">Report-DATE.xlsx</code>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <code className="bg-[var(--bg-card)] px-2 py-1 rounded text-[var(--text-primary)]">1099-2023-A.pdf</code>
                      <span className="text-[var(--text-muted)]">→</span>
                      <code className="bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] px-2 py-1 rounded">XXXX-YYYY-X.pdf</code>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[var(--bg-secondary)] rounded-xl">
                  <h4 className="font-semibold text-[var(--text-primary)] mb-3">Supported File Extensions</h4>
                  <div className="flex flex-wrap gap-2">
                    {['pdf', 'docx', 'xlsx', 'csv', 'txt', 'jpg', 'png', 'gif', 'mp4', 'zip', 'xml', 'json'].map(ext => (
                      <span key={ext} className="px-2 py-1 bg-[var(--bg-card)] rounded text-xs text-[var(--text-secondary)]">
                        .{ext}
                      </span>
                    ))}
                    <span className="px-2 py-1 bg-[var(--bg-card)] rounded text-xs text-[var(--text-muted)]">
                      + 20 more
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-[var(--bg-secondary)] rounded-xl">
                  <h4 className="font-semibold text-[var(--text-primary)] mb-3">Custom Prefixes</h4>
                  <p className="text-sm text-[var(--text-secondary)] mb-3">
                    Add custom prefixes in Options to help identify specific file types:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['1099', 'W2', 'INV-', 'RPT-', 'DOC-', 'IMG-'].map(prefix => (
                      <span key={prefix} className="px-3 py-1.5 bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded-lg text-sm font-mono">
                        {prefix}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tips Tab */}
          {activeTab === 'tips' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Tips & Best Practices</h3>
              
              <div className="space-y-3">
                <div className="flex gap-3 p-4 bg-[var(--bg-secondary)] rounded-xl">
                  <span className="text-xl">📄</span>
                  <div>
                    <h4 className="font-semibold text-[var(--text-primary)]">Document Preparation</h4>
                    <p className="text-sm text-[var(--text-secondary)]">
                      For best results, ensure file names in your document include extensions (.pdf, .docx, etc.). 
                      Text-based PDFs work better than scanned images.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-4 bg-[var(--bg-secondary)] rounded-xl">
                  <span className="text-xl">🤖</span>
                  <div>
                    <h4 className="font-semibold text-[var(--text-primary)]">When to Use AI Mode</h4>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Use AI mode for complex documents with irregular formatting, tables, or when regex misses files. 
                      Regex mode is faster and works well for clean, structured lists.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-4 bg-[var(--bg-secondary)] rounded-xl">
                  <span className="text-xl">🔍</span>
                  <div>
                    <h4 className="font-semibold text-[var(--text-primary)]">Filtering Results</h4>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Use extension filters to focus on specific file types. The minimum group size option 
                      helps reduce noise by moving single files to Miscellaneous.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-4 bg-[var(--bg-secondary)] rounded-xl">
                  <span className="text-xl">⌨️</span>
                  <div>
                    <h4 className="font-semibold text-[var(--text-primary)]">Keyboard Shortcuts</h4>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Press <kbd className="px-1.5 py-0.5 bg-[var(--bg-card)] rounded text-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-[var(--bg-card)] rounded text-xs">F</kbd> (or <kbd className="px-1.5 py-0.5 bg-[var(--bg-card)] rounded text-xs">⌘</kbd> + <kbd className="px-1.5 py-0.5 bg-[var(--bg-card)] rounded text-xs">F</kbd> on Mac) 
                      to quickly search through extracted file names.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-4 bg-[var(--bg-secondary)] rounded-xl">
                  <span className="text-xl">📊</span>
                  <div>
                    <h4 className="font-semibold text-[var(--text-primary)]">Export Options</h4>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Export to CSV to work with results in Excel or Google Sheets. The export includes 
                      pattern groups, file names, extensions, and duplicate flags.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-4 bg-[var(--bg-secondary)] rounded-xl">
                  <span className="text-xl">🔄</span>
                  <div>
                    <h4 className="font-semibold text-[var(--text-primary)]">Re-Analyze</h4>
                    <p className="text-sm text-[var(--text-secondary)]">
                      After viewing results, you can switch between AI and Regex modes using the re-analyze 
                      button to compare results without re-uploading.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FAQ Tab */}
          {activeTab === 'faq' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Frequently Asked Questions</h3>
              
              <FAQItem
                question="What file types can I upload?"
                answer="FileScope accepts PDF documents (.pdf), Word documents (.docx), and ZIP archives containing these file types. You can upload single files, multiple files, entire folders, or ZIP archives."
              />

              <FAQItem
                question="How do I process an entire folder?"
                answer="Click the 'Select Folder' button to choose a folder from your computer. All PDF and Word files will be automatically detected and processed together. Enable 'Include subfolders' to also scan nested directories."
              />

              <FAQItem
                question="How do ZIP files work?"
                answer="Upload a ZIP archive and FileScope will extract all PDF and Word files from it. Toggle 'Include subfolders' to process files in nested folders within the ZIP. Results from all files are combined into one view."
              />

              <FAQItem
                question="How does the AI analysis work?"
                answer="When AI mode is enabled, your document text is sent to OpenAI's GPT-4o-mini model, which analyzes the content to identify file names based on context. This is more accurate than regex for complex documents but requires an API key configured on the server."
              />

              <FAQItem
                question="What does the progress indicator show?"
                answer="When processing multiple files, you'll see real-time progress including: current file being processed, total files, successful/failed counts, and the current stage (extracting or analyzing)."
              />

              <FAQItem
                question="Why are some files in 'Miscellaneous'?"
                answer="Files are grouped by pattern. When only one file matches a specific pattern, it's placed in Miscellaneous to reduce clutter. You can adjust this with the 'Minimum Group Size' option."
              />

              <FAQItem
                question="What does the confidence score mean?"
                answer="In AI mode, each file name gets a confidence score (High, Medium, Low) indicating how certain the AI is that it's a valid file name. Filter by confidence to focus on the most reliable extractions."
              />

              <FAQItem
                question="What happens to my uploaded documents?"
                answer="Documents are processed in memory and not stored permanently. Text is extracted for analysis only. If using AI mode, the text is sent to OpenAI's API for processing."
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <p className="text-sm text-[var(--text-muted)]">
            Press <kbd className="px-1.5 py-0.5 bg-[var(--bg-card)] rounded text-xs">?</kbd> anytime to open this guide
          </p>
          <button
            onClick={onClose}
            className="btn-primary text-sm"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}

