import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Activity, X } from 'lucide-react';
import { GeminiLiveService } from '../services/geminiLiveService';
import { ParsedData } from '../types';

interface LiveAuditSessionProps {
  data: ParsedData;
  onClose: () => void;
}

const LiveAuditSession: React.FC<LiveAuditSessionProps> = ({ data, onClose }) => {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [activeSpeaker, setActiveSpeaker] = useState<'ai' | 'user' | 'none'>('none'); // Simulated for visual
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const serviceRef = useRef<GeminiLiveService | null>(null);

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      setErrorMessage(null);
      // Check API Key
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        console.error("No VITE_GEMINI_API_KEY found in environment");
        setErrorMessage('Tidak ada VITE_GEMINI_API_KEY. Periksa konfigurasi environment.');
        setStatus('error');
        return;
      }

      const service = new GeminiLiveService(apiKey);
      serviceRef.current = service;

      // Set the context for tools
      service.setDataContext({
          invoices: data.invoices,
          aging: data.aging,
          anomalies: data.anomalies,
          summary: data.summary
      });

      try {
        await service.connect(
          (text, isUser) => {
            // Handle transcription text if needed for UI logs
            setActiveSpeaker('ai');
            setTimeout(() => setActiveSpeaker('none'), 2000);
          },
          (newStatus) => {
            if (!mounted) return;
            setStatus(newStatus as any);
          }
        );
      } catch (err: any) {
        console.error('Failed to connect to Gemini Live:', err);
        if (!mounted) return;
        setErrorMessage(err?.message ? String(err.message) : 'Koneksi gagal. Periksa API key dan jaringan.');
        setStatus('error');
      }
    };

    start();

    return () => {
      mounted = false;
      serviceRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2"
        >
            <X className="w-6 h-6" />
        </button>

        <div className="p-8 flex flex-col items-center justify-center space-y-8 min-h-[400px]">
           {/* Visualizer */}
           <div className={`relative w-32 h-32 flex items-center justify-center rounded-full transition-all duration-500 ${
               status === 'connected' ? 'bg-blue-50 ring-4 ring-blue-100' : 'bg-slate-100'
           }`}>
               {status === 'connecting' && (
                   <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
               )}
               
               {status === 'connected' && (
                   <>
                     <div className={`absolute w-full h-full rounded-full border-4 border-blue-400 opacity-20 animate-ping`}></div>
                     <Activity className={`w-12 h-12 text-blue-600 ${activeSpeaker === 'ai' ? 'animate-pulse' : ''}`} />
                   </>
               )}

               {status === 'error' && <Activity className="w-12 h-12 text-red-500" />}
           </div>

           <div className="text-center space-y-2">
               <h2 className="text-2xl font-bold text-slate-800">
                   {status === 'connecting' && "Menghubungkan ke Mitra Audit..."}
                   {status === 'connected' && "Mitra AI Mendengarkan"}
                   {status === 'error' && "Kesalahan Koneksi"}
                   {status === 'disconnected' && "Sesi Berakhir"}
               </h2>
               <p className="text-slate-500 max-w-xs mx-auto">
                   {status === 'connected' 
                    ? "Tanyakan tentang umur piutang, anomali, pelanggan tertentu, atau ringkasan risiko."
                    : "Harap periksa izin mikrofon dan kunci API Anda."
                   }
               </p>
           </div>
           
           {status === 'connected' && (
               <div className="flex gap-4">
                   <div className="px-4 py-2 bg-slate-100 rounded-lg text-sm text-slate-600 flex items-center">
                       <Mic className="w-4 h-4 mr-2 text-green-600" /> Audio Langsung Aktif
                   </div>
               </div>
           )}

           {status === 'error' && (
                <div className="text-red-600 text-sm space-y-2">
                   <div>Pastikan <code>VITE_GEMINI_API_KEY</code> diatur dengan benar di environment.</div>
                   {errorMessage && <div className="text-xs text-red-500">{errorMessage}</div>}
                   <div className="mt-2 flex gap-2 justify-center">
                     <button
                       className="px-3 py-1 bg-blue-600 text-white rounded"
                       onClick={async () => {
                         setStatus('connecting');
                         setErrorMessage(null);
                         try {
                           if (serviceRef.current) {
                             await serviceRef.current.connect(
                               (t, isUser) => { setActiveSpeaker('ai'); setTimeout(() => setActiveSpeaker('none'), 2000); },
                               (s) => setStatus(s as any)
                             );
                           }
                         } catch (e: any) {
                           console.error('Retry failed', e);
                           setErrorMessage(e?.message ? String(e.message) : 'Retry gagal.');
                           setStatus('error');
                         }
                       }}
                     >Retry</button>
                     <button className="px-3 py-1 bg-gray-200 rounded" onClick={onClose}>Close</button>
                   </div>
                </div>
           )}
        </div>
        
        <div className="bg-slate-50 p-4 text-center text-xs text-slate-400 border-t border-slate-100">
            Didukung oleh Gemini 2.5 Native Audio • Mode Privasi: PII Disamarkan
        </div>
      </div>
    </div>
  );
};

export default LiveAuditSession;