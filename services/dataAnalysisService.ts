import { Invoice, AgingBucket, AgingReport, Anomaly, AuditSummary, ParsedData } from '../types';

export const parseCSV = async (file: File): Promise<ParsedData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const result = processCSVData(text);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsText(file);
  });
};

const processCSVData = (csvText: string): ParsedData => {
  // Robust CSV parsing: handle quoted fields and embedded newlines
  const detectDelimiter = (text: string) => {
    // Look at first non-empty line and count commas/semicolons outside quotes
    let inQuotes = false;
    let commaCount = 0;
    let semiCount = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        // toggle quote unless it's escaped by another quote
        if (text[i + 1] === '"') {
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (!inQuotes) {
        if (ch === ',') commaCount++;
        if (ch === ';') semiCount++;
        if (ch === '\n') break;
      }
    }
    return semiCount > commaCount ? ';' : ',';
  };

  const parseRows = (text: string, delimiter: string) => {
    const rows: string[][] = [];
    let cur: string = '';
    let row: string[] = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') {
          // escaped quote
          cur += '"';
          i++; // skip next
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (!inQuotes) {
        if (ch === delimiter) {
          row.push(cur);
          cur = '';
          continue;
        }
        if (ch === '\r') {
          // ignore, handle on \n
          continue;
        }
        if (ch === '\n') {
          row.push(cur);
          rows.push(row);
          row = [];
          cur = '';
          continue;
        }
      }
      cur += ch;
    }
    // push last field
    if (cur !== '' || row.length > 0) {
      row.push(cur);
      rows.push(row);
    }
    return rows;
  };

  // Trim BOM if present
  if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);

  const delimiter = detectDelimiter(csvText);
  const rows = parseRows(csvText, delimiter).filter(r => r.join('').trim() !== '');
  if (rows.length < 2) throw new Error('File CSV kosong atau header hilang');

  // Normalize header
  const cleanHeader = (h: string) => h.trim().replace(/^"|"$/g, '').toLowerCase();
  const headers = rows[0].map(cleanHeader);
  
  // Mapping logic (English and Indonesian support)
  const getIndex = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));
  
  const idxName = getIndex(['customer', 'client', 'name', 'pelanggan', 'nama', 'buyer', 'konsumen']);
  const idxInv = getIndex(['invoice', 'inv_num', 'ref', 'faktur', 'nomor', 'no.', 'no_faktur', 'bukti']);
  const idxDate = getIndex(['invoice_date', 'date', 'inv_date', 'tanggal', 'tgl', 'tgl_faktur', 'transaksi']);
  const idxDue = getIndex(['due', 'due_date', 'jatuh_tempo', 'tgl_jatuh_tempo', 'expire']);
  const idxAmt = getIndex(['amount', 'total', 'inv_amt', 'jumlah', 'nilai', 'harga', 'dpp', 'tagihan', 'nominal']);
  const idxPay = getIndex(['payment', 'paid', 'bayar', 'pembayaran', 'lunas', 'potongan', 'received']);
  // Note: If outstanding isn't in CSV, we calculate it
  const idxOut = getIndex(['outstanding', 'balance', 'sisa', 'saldo', 'tunggakan', 'belum_bayar']);

  if (idxName === -1) {
    throw new Error('Kolom wajib tidak ditemukan: Nama Pelanggan (Cari kolom: nama, pelanggan, customer, client)');
  }
  if (idxAmt === -1) {
    throw new Error('Kolom wajib tidak ditemukan: Jumlah/Nilai (Cari kolom: jumlah, nilai, amount, total, tagihan)');
  }

  const invoices: Invoice[] = [];
  const anomalies: Anomaly[] = [];
  const idSet = new Set<string>();

  const today = new Date(); // Simulating "Audit Date" as today

  // Process Rows (rows is an array of parsed fields)
  for (let i = 1; i < rows.length; i++) {
    // Each rows[i] is already an array of fields (may include surrounding quotes)
    const rawCols = rows[i];
    const cols = rawCols.map(c => (c ?? '').toString().trim().replace(/^"|"$/g, ''));
    
    if (cols.length < headers.length && cols.length < 2) continue; // Skip baris kosong/rusak

    const invId = idxInv !== -1 && cols[idxInv] ? cols[idxInv] : `INV-${i}`;
    
    // Helper untuk parsing angka (hapus 'Rp', '.', dan ganti ',' dengan '.')
    // Format Indo: 1.000.000,00 -> Perlu dibersihkan
    const parseNumber = (val: string): number => {
        if (!val) return 0;
        // Hapus simbol mata uang dan spasi
        let clean = val.replace(/[Rp\s]/g, '');
        // Cek jika format 1.000,00 (titik ribuan, koma desimal)
        if (clean.includes('.') && clean.includes(',')) {
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else if (clean.includes(',') && !clean.includes('.')) {
             // Jika hanya koma (1000,00), anggap desimal
             clean = clean.replace(',', '.');
        }
        return parseFloat(clean) || 0;
    };

    const amount = parseNumber(cols[idxAmt]);
    const payment = idxPay !== -1 ? parseNumber(cols[idxPay]) : 0;
    let outstanding = idxOut !== -1 ? parseNumber(cols[idxOut]) : (amount - payment);

    // 1. Reconciliation Check
    const calculatedOutstanding = amount - payment;
    // Toleransi 1.0 untuk pembulatan
    if (idxOut !== -1 && Math.abs(outstanding - calculatedOutstanding) > 1.0) {
      anomalies.push({
        id: invId,
        type: 'RECONCILIATION_ERROR',
        description: `Ketidakcocokan: Sisa terdaftar ${outstanding} != Terhitung ${calculatedOutstanding}`,
        severity: 'MEDIUM',
        value: Math.abs(outstanding - calculatedOutstanding)
      });
      outstanding = calculatedOutstanding; // Correct it for analysis
    }

    // 2. Duplicate Check
    if (idSet.has(invId) && invId !== `INV-${i}`) {
      anomalies.push({
        id: invId,
        type: 'DUPLICATE_ID',
        description: `Duplikasi ID Faktur terdeteksi: ${invId}`,
        severity: 'HIGH'
      });
    }
    idSet.add(invId);

    // 3. Negative Amount Check
    if (amount < 0) {
      anomalies.push({
        id: invId,
        type: 'NEGATIVE_AMOUNT',
        description: `Nilai faktur negatif ditemukan`,
        severity: 'HIGH',
        value: amount
      });
    }

    // Dates parsing
    // Helper simple date parser (accepts YYYY-MM-DD or DD/MM/YYYY)
    const parseDate = (dateStr: string): string => {
        if (!dateStr) return new Date().toISOString().split('T')[0];
        try {
            // Jika format DD/MM/YYYY atau DD-MM-YYYY
            if (dateStr.match(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/)) {
                const parts = dateStr.split(/[\/-]/);
                return `${parts[2]}-${parts[1]}-${parts[0]}`; // Convert to YYYY-MM-DD
            }
            return new Date(dateStr).toISOString().split('T')[0];
        } catch {
            return new Date().toISOString().split('T')[0];
        }
    };

    const invDateStr = idxDate !== -1 ? parseDate(cols[idxDate]) : new Date().toISOString().split('T')[0];
    const dueDateStr = idxDue !== -1 ? parseDate(cols[idxDue]) : invDateStr; // Fallback
    
    // Days Overdue
    const dueDateObj = new Date(dueDateStr);
    const diffTime = today.getTime() - dueDateObj.getTime();
    const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    invoices.push({
      id: invId,
      customerName: cols[idxName] || 'Tanpa Nama',
      invoiceDate: invDateStr,
      dueDate: dueDateStr,
      amount,
      paymentAmount: payment,
      outstanding,
      status: outstanding <= 100 ? 'PAID' : (daysOverdue > 0 ? 'OPEN' : 'PARTIAL'), // Threshold kecil untuk paid
      daysOverdue: outstanding > 100 ? daysOverdue : 0
    });
  }

  // 4. Unusual High Value (Simple Statistical Anomaly)
  const amounts = invoices.map(i => i.amount);
  const mean = amounts.reduce((a, b) => a + b, 0) / (amounts.length || 1);
  const stdDev = Math.sqrt(amounts.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / (amounts.length || 1));
  const threshold = mean + (3 * stdDev); // 3 Sigma

  if (amounts.length > 5) { // Hanya cek jika data cukup
      invoices.forEach(inv => {
        if (inv.amount > threshold && inv.amount > 0) {
          anomalies.push({
            id: inv.id,
            type: 'UNUSUAL_HIGH_VALUE',
            description: `Jumlah faktur ${inv.amount.toLocaleString()} jauh lebih tinggi dari rata-rata`,
            severity: 'MEDIUM',
            value: inv.amount
          });
        }
      });
  }

  // Calculate Aging
  const agingReport: AgingReport[] = [
    { bucket: AgingBucket.CURRENT, amount: 0, count: 0 },
    { bucket: AgingBucket.DAYS_1_30, amount: 0, count: 0 },
    { bucket: AgingBucket.DAYS_31_60, amount: 0, count: 0 },
    { bucket: AgingBucket.DAYS_61_90, amount: 0, count: 0 },
    { bucket: AgingBucket.OVER_90, amount: 0, count: 0 },
  ];

  invoices.filter(i => i.outstanding > 100).forEach(inv => {
    let bucketIndex = 0;
    if (inv.daysOverdue <= 0) bucketIndex = 0;
    else if (inv.daysOverdue <= 30) bucketIndex = 1;
    else if (inv.daysOverdue <= 60) bucketIndex = 2;
    else if (inv.daysOverdue <= 90) bucketIndex = 3;
    else bucketIndex = 4;

    agingReport[bucketIndex].amount += inv.outstanding;
    agingReport[bucketIndex].count += 1;
  });

  // Summary
  const totalReceivables = invoices.reduce((sum, inv) => sum + inv.outstanding, 0);
  const totalOverdue = invoices.filter(i => i.daysOverdue > 0).reduce((sum, inv) => sum + inv.outstanding, 0);
  const uniqueCustomers = new Set(invoices.map(i => i.customerName)).size;
  
  // DSO Calculation
  const dso = totalReceivables > 0 ? (totalReceivables / (invoices.reduce((s, i) => s + i.amount, 0) || 1)) * 365 : 0;

  // Simple Risk Score
  const highRiskRatio = (agingReport[4].amount / (totalReceivables || 1));
  const anomalyPenalty = anomalies.filter(a => a.severity === 'HIGH').length * 10;
  const riskScore = Math.min(100, Math.round((highRiskRatio * 100) + anomalyPenalty + (dso > 60 ? 10 : 0)));

  return {
    invoices,
    aging: agingReport,
    anomalies,
    summary: {
      totalReceivables,
      totalOverdue,
      dso: Math.round(dso),
      riskScore,
      invoiceCount: invoices.length,
      customerCount: uniqueCustomers
    }
  };
};