import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { createPcmBlob, decodeAudioData, PCM_SAMPLE_RATE_INPUT, PCM_SAMPLE_RATE_OUTPUT, resampleTo16k, base64ToUint8Array } from '../utils/audioUtils';
import { ToolContext } from '../types';

// --- Tool Definitions ---

const getAuditSummaryTool: FunctionDeclaration = {
  name: 'getAuditSummary',
  description: 'Dapatkan ringkasan tingkat tinggi dari audit termasuk total piutang, DSO, dan skor risiko.',
  parameters: { type: Type.OBJECT, properties: {} }
};

const getAgingReportTool: FunctionDeclaration = {
  name: 'getAgingReport',
  description: 'Dapatkan jadwal umur piutang (aging schedule) secara rinci (Lancar, 1-30, 31-60, 61-90, >90 hari).',
  parameters: { type: Type.OBJECT, properties: {} }
};

const getAnomaliesTool: FunctionDeclaration = {
  name: 'getAnomalies',
  description: 'Dapatkan daftar anomali data, risiko penipuan (fraud), atau kesalahan rekonsiliasi yang terdeteksi.',
  parameters: { type: Type.OBJECT, properties: {} }
};

const getCustomerDetailsTool: FunctionDeclaration = {
  name: 'getCustomerDetails',
  description: 'Dapatkan detail untuk nama pelanggan tertentu.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Nama pelanggan' }
    },
    required: ['name']
  }
};

// --- Service Class ---

export class GeminiLiveService {
  private client: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private dataContext: ToolContext | null = null;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  setDataContext(context: ToolContext) {
    this.dataContext = context;
  }

  async connect(onMessage: (text: string, isUser: boolean) => void, onStatusChange: (status: string) => void) {
    onStatusChange('connecting');

    // Initialize Audio Contexts
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: PCM_SAMPLE_RATE_INPUT });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: PCM_SAMPLE_RATE_OUTPUT });
    
    // System Instruction (Indonesian)
    const systemInstruction = `
      Anda adalah Mitra Audit AI ahli yang berspesialisasi dalam Piutang Usaha (Accounts Receivable).
      Peran Anda adalah menganalisis data keuangan yang diberikan (konteks CSV) melalui alat yang tersedia.
      
      Bahasa: WAJIB MENGGUNAKAN BAHASA INDONESIA yang profesional namun komunikatif.
      
      Kemampuan:
      1. Analisis Jadwal Umur Piutang (Aging Schedule) dan DSO.
      2. Deteksi anomali (Duplikasi, Kesalahan Rekonsiliasi, Nilai Tinggi/Tidak Wajar).
      3. Berikan penilaian risiko dan rekomendasi audit.
      
      Aturan:
      - Selalu gunakan alat (tools) yang disediakan untuk mengambil data. Jangan mengarang angka (halusinasi).
      - Jika anomali ditemukan, jelaskan potensi dampaknya terhadap keuangan.
      - Berikan respons ringkas, padat, dan jelas karena ini adalah interaksi suara.
      - Jika pengguna meminta PII (informasi identitas pribadi) yang tidak ada dalam kolom aman, tolak dengan sopan.
    `;

    // Connect to Live API
    try {
      this.sessionPromise = this.client.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          tools: [{ functionDeclarations: [getAuditSummaryTool, getAgingReportTool, getAnomaliesTool, getCustomerDetailsTool] }]
        },
        callbacks: {
            onopen: () => {
                onStatusChange('connected');
                this.startMicrophone();
            },
            onmessage: async (msg: LiveServerMessage) => {
                // 1. Handle Tool Calls
                if (msg.toolCall) {
                    this.handleToolCall(msg.toolCall);
                }

                // 2. Handle Audio Output
                const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData && this.outputAudioContext) {
                    this.playAudioResponse(audioData);
                }

                // 3. Handle Transcriptions (Optional for UI)
                if (msg.serverContent?.modelTurn?.parts?.[0]?.text) {
                     onMessage(msg.serverContent.modelTurn.parts[0].text, false);
                }
            },
            onclose: () => {
                onStatusChange('disconnected');
                this.stopAudio();
            },
            onerror: (err) => {
                console.error("Gemini Live Error:", err);
                onStatusChange('error');
            }
        }
      });
    } catch (e) {
      console.error(e);
      onStatusChange('error');
    }
  }

  private async handleToolCall(toolCall: any) {
    if (!this.sessionPromise || !this.dataContext) return;

    const functionResponses = [];

    for (const fc of toolCall.functionCalls) {
        let result: any = {};
        
        try {
            switch (fc.name) {
                case 'getAuditSummary':
                    result = this.dataContext.summary;
                    break;
                case 'getAgingReport':
                    result = this.dataContext.aging;
                    break;
                case 'getAnomalies':
                    result = this.dataContext.anomalies;
                    break;
                case 'getCustomerDetails':
                    const name = (fc.args as any).name?.toLowerCase();
                    const customerInvoices = this.dataContext.invoices.filter(i => i.customerName.toLowerCase().includes(name));
                    const totalDebt = customerInvoices.reduce((sum, i) => sum + i.outstanding, 0);
                    result = {
                        found: customerInvoices.length > 0,
                        invoiceCount: customerInvoices.length,
                        totalOutstanding: totalDebt,
                        invoices: customerInvoices.slice(0, 5) // Limit to 5 for context window
                    };
                    break;
                default:
                    result = { error: "Fungsi tidak dikenal" };
            }
        } catch (err: any) {
            result = { error: err.message };
        }

        functionResponses.push({
            id: fc.id,
            name: fc.name,
            response: { result }
        });
    }

    const session = await this.sessionPromise;
    session.sendToolResponse({ functionResponses });
  }

  private async startMicrophone() {
    if (!this.inputAudioContext) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.inputAudioContext.createMediaStreamSource(stream);
      
      // Using ScriptProcessor for simplicity in this demo structure, 
      // though AudioWorklet is preferred for production.
      const processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Resample to 16kHz
        const resampled = resampleTo16k(inputData, this.inputAudioContext!.sampleRate);
        const pcmData = createPcmBlob(resampled);
        
        if (this.sessionPromise) {
            this.sessionPromise.then(session => {
                session.sendRealtimeInput({ 
                  media: {
                    data: pcmData.data,
                    mimeType: pcmData.mimeType
                  }
                });
            });
        }
      };

      source.connect(processor);
      processor.connect(this.inputAudioContext.destination);
    } catch (err) {
      console.error("Microphone error", err);
    }
  }

  private async playAudioResponse(base64Audio: string) {
    if (!this.outputAudioContext) return;

    try {
        const audioBuffer = await decodeAudioData(
            base64ToUint8Array(base64Audio),
            this.outputAudioContext,
            PCM_SAMPLE_RATE_OUTPUT
        );

        this.nextStartTime = Math.max(this.outputAudioContext.currentTime, this.nextStartTime);
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputAudioContext.destination);
        source.start(this.nextStartTime);
        
        this.nextStartTime += audioBuffer.duration;
    } catch (e) {
        console.error("Audio decode error", e);
    }
  }

  private stopAudio() {
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();
    this.inputAudioContext = null;
    this.outputAudioContext = null;
  }

  disconnect() {
      // No explicit disconnect method on session currently exposed in standard way 
      // other than just dropping references or if the library supported it.
      // We simulate by closing audio contexts.
      this.stopAudio();
      this.sessionPromise = null;
  }
}