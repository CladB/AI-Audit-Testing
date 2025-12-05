import React, { useState } from 'react';
import { Mic, FileSpreadsheet, LayoutDashboard, ShieldCheck } from 'lucide-react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import LiveAuditSession from './components/LiveAuditSession';
import { ParsedData } from './types';

function App() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [isLiveSessionOpen, setIsLiveSessionOpen] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Navbar */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-400 rounded-lg">
             <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Audit <span className="text-pink-400">AIVoice</span> by <span className="text-pink-400">Asierra</span></h1>
        </div>
        
        {data && (
           <button 
             onClick={() => setIsLiveSessionOpen(true)}
             className="flex items-center gap-2 px-4 py-2 bg-pink-400 hover:bg-pink-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
           >
             <Mic className="w-4 h-4" />
             <span className="text-white">Mulai Audit Suara</span>
           </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {!data ? (
          <FileUpload onDataLoaded={setData} />
        ) : (
          <Dashboard data={data} />
        )}
      </main>

      {/* Live Session Overlay */}
      {isLiveSessionOpen && data && (
        <LiveAuditSession 
            data={data} 
            onClose={() => setIsLiveSessionOpen(false)} 
        />
      )}
    </div>
  );
}

export default App;