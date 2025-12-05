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
  const serviceRef = useRef<GeminiLiveService | null>(null);

  useEffect(() => {
    // Check API Key
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("No VITE_GEMINI_API_KEY found in environment");
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

    // Connect
    service.connect(
      (text, isUser) => {
        // Handle transcription text if needed for UI logs
        // For now we just use it to animate speaker
        setActiveSpeaker('ai');
        setTimeout(() => setActiveSpeaker('none'), 2000); 
      },
      (newStatus) => {
        setStatus(newStatus as any);
      }
    );

    return () => {
      service.disconnect();
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
                <div className="text-red-600 text-sm">
                   Pastikan `VITE_GEMINI_API_KEY` diatur dengan benar di environment.
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