import React from 'react';
import { ParsedData, AgingBucket } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { AlertTriangle, TrendingUp, Users, DollarSign, FileText } from 'lucide-react';

interface DashboardProps {
  data: ParsedData;
}

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const { summary, aging, anomalies } = data;

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'];

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto custom-scrollbar">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between pb-2">
            <h3 className="text-sm font-medium text-slate-500">Total Piutang</h3>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(summary.totalReceivables)}</div>
          <p className="text-xs text-slate-400 mt-1">{summary.invoiceCount} faktur diproses</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between pb-2">
            <h3 className="text-sm font-medium text-slate-500">Total Jatuh Tempo</h3>
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalOverdue)}</div>
          <p className="text-xs text-slate-400 mt-1">Butuh perhatian segera</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between pb-2">
            <h3 className="text-sm font-medium text-slate-500">Skor Risiko</h3>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className={`text-2xl font-bold ${summary.riskScore > 70 ? 'text-red-600' : 'text-slate-900'}`}>
            {summary.riskScore}/100
          </div>
          <p className="text-xs text-slate-400 mt-1">Berdasarkan umur piutang & anomali</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between pb-2">
            <h3 className="text-sm font-medium text-slate-500">DSO</h3>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{summary.dso} Hari</div>
          <p className="text-xs text-slate-400 mt-1">Rata-rata Hari Pelunasan</p>
        </div>
      </div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aging Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Jadwal Umur Piutang (Aging Schedule)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aging} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="bucket" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {aging.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Anomalies List */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
             Anomali Terdeteksi 
             <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">{anomalies.length}</span>
          </h3>
          <div className="overflow-y-auto max-h-64 custom-scrollbar">
            {anomalies.length === 0 ? (
                <div className="text-slate-400 text-center py-8">Tidak ada anomali terdeteksi.</div>
            ) : (
                <ul className="space-y-3">
                {anomalies.map((anomaly, idx) => (
                    <li key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex justify-between items-start mb-1">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            anomaly.severity === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{anomaly.type}</span>
                        <span className="text-xs text-slate-400">{anomaly.id}</span>
                    </div>
                    <p className="text-sm text-slate-700">{anomaly.description}</p>
                    </li>
                ))}
                </ul>
            )}
          </div>
        </div>
      </div>
      
      {/* Sample Invoice Table (Top 5 Overdue) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
         <h3 className="text-lg font-semibold text-slate-800 mb-4">Faktur Jatuh Tempo Terbesar</h3>
         <div className="overflow-x-auto">
             <table className="w-full text-left text-sm">
                 <thead>
                     <tr className="bg-slate-50 border-b border-slate-200">
                         <th className="p-3 font-medium text-slate-600">Pelanggan</th>
                         <th className="p-3 font-medium text-slate-600">ID Faktur</th>
                         <th className="p-3 font-medium text-slate-600">Jatuh Tempo</th>
                         <th className="p-3 font-medium text-slate-600 text-right">Sisa Tagihan</th>
                         <th className="p-3 font-medium text-slate-600 text-right">Hari Lewat</th>
                     </tr>
                 </thead>
                 <tbody>
                     {data.invoices
                        .filter(i => i.daysOverdue > 0)
                        .sort((a,b) => b.daysOverdue - a.daysOverdue)
                        .slice(0, 5)
                        .map(inv => (
                            <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="p-3 font-medium text-slate-800">{inv.customerName}</td>
                                <td className="p-3 text-slate-600">{inv.id}</td>
                                <td className="p-3 text-slate-600">{inv.dueDate}</td>
                                <td className="p-3 text-slate-800 text-right font-medium">{formatCurrency(inv.outstanding)}</td>
                                <td className="p-3 text-red-600 text-right">{inv.daysOverdue}</td>
                            </tr>
                        ))
                     }
                 </tbody>
             </table>
         </div>
      </div>

    </div>
  );
};

export default Dashboard;