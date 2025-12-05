import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { parseCSV } from '../services/dataAnalysisService';
import { ParsedData } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: ParsedData) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const processFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const data = await parseCSV(file);
      onDataLoaded(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memproses CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      processFile(file);
    } else {
      setError('Harap unggah file CSV yang valid.');
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div 
        className={`w-full max-w-xl p-12 border-2 border-dashed rounded-xl transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center text-center">
          <div className="p-4 bg-blue-100 rounded-full mb-4">
            <Upload className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Unggah Data Audit</h3>
          <p className="text-slate-500 mb-6">Tarik dan lepas file CSV piutang Anda di sini, atau klik tombol untuk menelusuri.</p>
          
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors">
            Cari File
            <input type="file" className="hidden" accept=".csv" onChange={handleChange} />
          </label>

          {loading && <p className="mt-4 text-blue-600">Memproses data...</p>}
          
          {error && (
            <div className="mt-6 flex items-center p-3 text-red-700 bg-red-50 rounded-lg">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-8 max-w-xl text-sm text-slate-500">
        <p className="font-semibold mb-2">Kolom CSV yang Diperlukan (Fleksibel):</p>
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 bg-slate-200 rounded">Nama Pelanggan</span>
          <span className="px-2 py-1 bg-slate-200 rounded">No. Faktur</span>
          <span className="px-2 py-1 bg-slate-200 rounded">Tanggal Faktur</span>
          <span className="px-2 py-1 bg-slate-200 rounded">Jumlah/Amount</span>
          <span className="px-2 py-1 bg-slate-200 rounded">Pembayaran/Lunas</span>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;