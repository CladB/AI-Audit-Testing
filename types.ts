export interface Invoice {
  id: string;
  customerName: string;
  invoiceDate: string; // ISO format YYYY-MM-DD
  dueDate: string; // ISO format YYYY-MM-DD
  amount: number;
  paymentAmount: number;
  outstanding: number;
  status: 'PAID' | 'PARTIAL' | 'OPEN';
  daysOverdue: number;
}

export enum AgingBucket {
  CURRENT = 'Belum Jatuh Tempo',
  DAYS_1_30 = '1-30 Hari',
  DAYS_31_60 = '31-60 Hari',
  DAYS_61_90 = '61-90 Hari',
  OVER_90 = '> 90 Hari'
}

export interface AgingReport {
  bucket: AgingBucket;
  amount: number;
  count: number;
}

export interface Anomaly {
  id: string; // Invoice ID or 'System'
  type: 'DUPLICATE_ID' | 'NEGATIVE_AMOUNT' | 'RECONCILIATION_ERROR' | 'UNUSUAL_HIGH_VALUE' | 'DATA_QUALITY';
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  value?: number;
}

export interface AuditSummary {
  totalReceivables: number;
  totalOverdue: number;
  dso: number; // Days Sales Outstanding
  riskScore: number; // 0-100
  invoiceCount: number;
  customerCount: number;
}

export interface ParsedData {
  invoices: Invoice[];
  aging: AgingReport[];
  anomalies: Anomaly[];
  summary: AuditSummary;
}

// Gemini Live Types
export type LiveStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ToolContext {
  invoices: Invoice[];
  summary: AuditSummary;
  aging: AgingReport[];
  anomalies: Anomaly[];
}