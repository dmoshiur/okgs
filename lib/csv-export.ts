/**
 * CSV Export Utilities
 * Generic CSV export functions for various data types
 */

/** Escape a value for CSV */
export function escapeCSV(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Escape double quotes by doubling them
  if (str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  // Only quote if contains comma, newline, or other special characters
  if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('\t')) {
    return `"${str}"`;
  }
  return str;
}

/** Generate CSV content from headers and rows */
export function generateCSV(headers: string[], rows: Array<string[]>): string {
  const csvLines = [
    headers.map(escapeCSV).join(","),
    ...rows.map(row => row.map(escapeCSV).join(","))
  ];
  return csvLines.join("\n");
}

/** Convert an array of objects to CSV */
export function objectsToCSV(data: Record<string, unknown>[], columns?: string[]): string {
  if (!data.length) return "";
  
  // Get all keys if columns not specified
  const allKeys = Object.keys(data[0]);
  const keys = columns || allKeys;
  
  // Create headers
  const headers = keys.map(key => key);
  
  // Create rows
  const rows = data.map(item => {
    return keys.map(key => {
      const value = item[key];
      if (value === null || value === undefined) return "";
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
    });
  });
  
  return generateCSV(headers, rows);
}

/** Format a date for CSV export */
export function formatDateForCSV(dateString: string | null | undefined): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

/** Format currency for CSV export */
export function formatCurrencyForCSV(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "";
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(num)) return String(amount);
  return `৳${Math.round(num).toLocaleString('bn-BD')}`;
}

/** Create a downloadable CSV file */
export function downloadCSV(csvContent: string, filename: string): void {
  if (typeof window === 'undefined') return;
  
  const blob = new Blob([csvContent], { type: 'text/csv; charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(link);
}

/** Generate CSV filename with timestamp */
export function generateCSVFilename(prefix: string, extension: string = 'csv'): string {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${timestamp}.${extension}`;
}

/** Filter options for CSV export */
export interface CSVExportOptions {
  filename?: string;
  columns?: string[];
  includeHeaders?: boolean;
}

/** Export data to CSV with options */
export function exportToCSV(
  data: Record<string, unknown>[],
  options: CSVExportOptions = {}
): string {
  const { columns, includeHeaders = true } = options;
  
  if (!data.length) return "";
  
  const allKeys = Object.keys(data[0]);
  const keys = columns || allKeys;
  
  const csvRows: string[][] = [];
  
  // Add headers if requested
  if (includeHeaders) {
    csvRows.push(keys);
  }
  
  // Add data rows
  data.forEach(item => {
    const row = keys.map(key => {
      const value = item[key];
      if (value === null || value === undefined) return "";
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    });
    csvRows.push(row);
  });
  
  return generateCSV(keys, csvRows);
}