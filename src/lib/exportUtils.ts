import * as XLSX from 'xlsx';

// Types matching the application's structure
interface ExtractedFileName {
  name: string;
  extension: string;
  line?: number;
  confidence?: 'high' | 'medium' | 'low' | number;
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

/**
 * Export analysis results to JSON format
 */
export function exportToJSON(analysis: AnalysisResult, sourceInfo: string): string {
  const exportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      source: sourceInfo,
      totalFiles: analysis.totalFound,
      patternGroups: analysis.patterns.length,
      duplicates: analysis.duplicates.length,
      aiEnhanced: analysis.aiEnhanced || false,
      documentType: analysis.documentType,
      summary: analysis.summary,
    },
    patterns: analysis.patterns.map(group => ({
      pattern: group.pattern,
      description: group.description,
      count: group.count,
      files: group.files.map(file => ({
        name: file.name,
        extension: file.extension,
        confidence: file.confidence,
        line: file.line,
      })),
    })),
    duplicates: analysis.duplicates,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export analysis results to Excel format
 */
export function exportToExcel(analysis: AnalysisResult, sourceInfo: string): Blob {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['FileScope Analysis Report'],
    ['Exported At', new Date().toLocaleString()],
    ['Source', sourceInfo],
    ['Total Files Found', analysis.totalFound],
    ['Pattern Groups', analysis.patterns.length],
    ['Duplicates', analysis.duplicates.length],
    ['AI Enhanced', analysis.aiEnhanced ? 'Yes' : 'No'],
    [],
    ['Document Type', analysis.documentType || 'N/A'],
    ['Summary', analysis.summary || 'N/A'],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Patterns sheet
  const patternsData = [
    ['Pattern', 'Description', 'File Count', 'Files'],
  ];

  for (const group of analysis.patterns) {
    const fileNames = group.files.map(f => f.name).join('; ');
    patternsData.push([
      group.pattern,
      group.description || '',
      String(group.count),
      fileNames,
    ]);
  }

  const patternsSheet = XLSX.utils.aoa_to_sheet(patternsData);
  XLSX.utils.book_append_sheet(workbook, patternsSheet, 'Patterns');

  // Detailed files sheet
  const filesData = [
    ['File Name', 'Extension', 'Pattern Group', 'Confidence', 'Is Duplicate', 'Source'],
  ];

  for (const group of analysis.patterns) {
    for (const file of group.files) {
      filesData.push([
        file.name,
        file.extension,
        group.pattern,
        file.confidence ? `${Math.round(Number(file.confidence) * 100)}%` : '',
        analysis.duplicates.includes(file.name) ? 'Yes' : 'No',
        sourceInfo,
      ]);
    }
  }

  const filesSheet = XLSX.utils.aoa_to_sheet(filesData);
  XLSX.utils.book_append_sheet(workbook, filesSheet, 'All Files');

  // Duplicates sheet
  if (analysis.duplicates.length > 0) {
    const dupData = [['Duplicate File Names']];
    for (const dup of analysis.duplicates) {
      dupData.push([dup]);
    }
    const dupSheet = XLSX.utils.aoa_to_sheet(dupData);
    XLSX.utils.book_append_sheet(workbook, dupSheet, 'Duplicates');
  }

  const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Export analysis results to Markdown format
 */
export function exportToMarkdown(analysis: AnalysisResult, sourceInfo: string): string {
  const lines: string[] = [];

  lines.push('# FileScope Analysis Report\n');
  lines.push(`**Exported:** ${new Date().toLocaleString()}\n`);
  lines.push(`**Source:** ${sourceInfo}\n`);
  lines.push(`**Total Files Found:** ${analysis.totalFound}\n`);
  lines.push(`**Pattern Groups:** ${analysis.patterns.length}\n`);
  lines.push(`**Duplicates:** ${analysis.duplicates.length}\n`);
  lines.push(`**AI Enhanced:** ${analysis.aiEnhanced ? 'Yes' : 'No'}\n`);

  if (analysis.documentType) {
    lines.push(`**Document Type:** ${analysis.documentType}\n`);
  }

  if (analysis.summary) {
    lines.push(`\n## Summary\n\n${analysis.summary}\n`);
  }

  lines.push('\n## Pattern Groups\n\n');

  for (const group of analysis.patterns) {
    lines.push(`### ${group.pattern}\n`);
    if (group.description) {
      lines.push(`*${group.description}*\n`);
    }
    lines.push(`**Count:** ${group.count} files\n\n`);

    lines.push('| File Name | Extension | Confidence | Duplicate |\n');
    lines.push('|-----------|-----------|------------|-----------|\n');

    for (const file of group.files) {
      const confidence = file.confidence ? `${Math.round(Number(file.confidence) * 100)}%` : 'N/A';
      const isDup = analysis.duplicates.includes(file.name) ? 'Yes' : 'No';
      lines.push(`| ${file.name} | ${file.extension} | ${confidence} | ${isDup} |\n`);
    }

    lines.push('\n');
  }

  if (analysis.duplicates.length > 0) {
    lines.push('## Duplicates\n\n');
    for (const dup of analysis.duplicates) {
      lines.push(`- ${dup}\n`);
    }
    lines.push('\n');
  }

  return lines.join('');
}

/**
 * Download a file
 */
export function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

