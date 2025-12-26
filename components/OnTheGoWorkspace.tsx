
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Message, AvatarSeed, GenSettings, ValidAspectRatio, IntelligenceMode, GalleryItem } from '../types.ts';
import { chatWithSearch, generateImage } from '../services/geminiService.ts';
import { 
  Send, Upload, X, Loader2, Sparkles, Globe, 
  ExternalLink, Maximize2, RefreshCcw, Download, 
  ChevronLeft, Trash2, BrainCircuit, Bot, User,
  Image as ImageIcon, Sliders, Info,
  Edit2, Pin, Check, Search, Zap, Lightbulb,
  MousePointer2, Settings2, Palette, Copy, Scissors, RotateCw, Filter, History
} from 'lucide-react';

interface Props {
  seeds: AvatarSeed[];
  settings: GenSettings;
  onUpdateSettings: (s: GenSettings) => void;
  onBackToHome: () => void;
  onAddSeed: (data: string, name: string, tags: string[]) => void;
  isKeySelected: boolean;
  gallery: GalleryItem[];
}

const ANYA_AVATAR_URL = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256&h=256";

const LOADING_MESSAGES = [
  "Doing the magic...",
  "Pouring the magic masala...",
  "Generating the image...",
  "Weaving latent pixels...",
  "Assembling your vision...",
  "Processing neural Rig...",
  "Consulting the banana oracle..."
];

const OnTheGoWorkspace: React.FC<Props> = ({ 
  seeds, settings, onUpdateSettings, onBackToHome, onAddSeed, isKeySelected, gallery
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [progress, setProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [history, setHistory] = useState<{ role: 'user' | 'model', parts: any[] }[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showMoods, setShowMoods] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [pinnedMentions, setPinnedMentions] = useState<string[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [lastSearchContext, setLastSearchContext] = useState<string>('');
  
  // New States
  const [seedSearch, setSeedSearch] = useState('');
  const [isGalleryExpanded, setIsGalleryExpanded] = useState(false);
  const [selectedGalleryItem, setSelectedGalleryItem] = useState<GalleryItem | null>(null);
  const [editingPreviewIdx, setEditingPreviewIdx] = useState<number | null>(null);
  const [editorState, setEditorState] = useState({ brightness: 100, contrast: 100, rotation: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const progressTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Deeply fixed auto-scroll logic
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages.length, isLoading]);

  useEffect(() => {
    if (isLoading) {
      const updateMsg = () => {
        setLoadingMsg(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
      };
      updateMsg();
      const interval = setInterval(updateMsg, 2500);
      
      setProgress(5);
      progressTimerRef.current = window.setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + Math.random() * 2 : prev));
      }, 300);
      
      return () => {
        clearInterval(interval);
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      };
    } else {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setProgress(0);
    }
  }, [isLoading]);

  const stripMarkdown = (text: string) => {
    return text.replace(/\*\*/g, '').replace(/—/g, '-').trim();
  };

  const [selectedModes, setSelectedModes] = useState<IntelligenceMode[]>([IntelligenceMode.REASONING]);

  const toggleMode = (mode: IntelligenceMode) => {
    setSelectedModes(prev => 
      prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]
    );
  };

  const handleSend = async () => {
    if ((!input.trim() && previews.length === 0) || isLoading) return;
    if (!isKeySelected) {
      alert("Please select a Pro Key first.");
      return;
    }

    const currentInput = input;
    const currentPreviews = [...previews];
    const isEditing = !!editingMessageId;

    if (isEditing) {
      setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, text: currentInput, images: currentPreviews } : m));
      setEditingMessageId(null);
    } else {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: currentInput,
        images: currentPreviews
      };
      setMessages(prev => [...prev, userMessage]);
    }

    setInput('');
    setPreviews([]);
    setIsLoading(true);

    try {
      const isNewRequest = /start over|new image|different person/i.test(currentInput);
      const isGenerationRequest = /generate|create|render|make|change|add|put|swap|move|put|image|look like|draw/i.test(currentInput);

      if (!isGenerationRequest) {
        const response = await chatWithSearch(currentInput, currentPreviews, history, selectedModes);
        const textOutput = stripMarkdown(response.text || "");
        
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: textOutput,
          grounding: response.grounding,
          isSearch: response.grounding.length > 0
        };
        
        setLastSearchContext(textOutput);
        setMessages(prev => [...prev, botMessage]);
        setHistory(prev => [
          ...prev, 
          { role: 'user', parts: [{ text: currentInput }] },
          { role: 'model', parts: [{ text: response.text }] }
        ]);
      } else {
        let contextImages: string[] = [];
        contextImages.push(...currentPreviews);
        if (previewImage && !isNewRequest) contextImages.push(previewImage);
        seeds.forEach(s => {
          if (currentInput.includes(`@${s.name.replace(/\s+/g, '')}`)) contextImages.push(s.imageData);
        });

        const response = await generateImage(currentInput, contextImages, {
          aspectRatio: settings.aspectRatio === "Original" ? "16:9" : settings.aspectRatio,
          imageSize: settings.imageSize,
          temperature: settings.temperature,
          faceFidelity: settings.faceFidelity,
          strictness: settings.strictness,
          searchContext: lastSearchContext 
        });

        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: "Here's the vision!",
          images: response.images
        };
        setMessages(prev => [...prev, botMessage]);
        if (response.images.length > 0) setPreviewImage(response.images[0]);
      }
    } catch (e: any) {
      alert("Anya Error: " + e.message);
    } finally {
      setIsLoading(false);
      setTimeout(scrollToBottom, 50);
    }
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(input);
  };

  const applyEdits = () => {
    if (editingPreviewIdx === null || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const is90 = editorState.rotation % 180 !== 0;
      canvas.width = is90 ? img.height : img.width;
      canvas.height = is90 ? img.width : img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.filter = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%)`;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((editorState.rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
      const finalData = canvas.toDataURL('image/jpeg', 0.95);
      setPreviews(prev => {
        const next = [...prev];
        next[editingPreviewIdx] = finalData;
        return next;
      });
      setEditingPreviewIdx(null);
    };
    img.src = previews[editingPreviewIdx];
  };

  const filteredSeeds = seeds.filter(s => 
    s.name.toLowerCase().includes(seedSearch.toLowerCase()) || 
    (s.tags && s.tags.some(t => t.toLowerCase().includes(seedSearch.toLowerCase())))
  );

  return (
    <div className="flex h-full w-full bg-[#020408] overflow-hidden">
      {/* Top Progress Bar */}
      <div className={`absolute top-0 left-0 w-full h-1 z-[100] transition-opacity duration-300 ${progress > 0 ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-full bg-[#10b981] shadow-[0_0_15px_#10b981] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Left: Chat Panel */}
      <div className="w-[360px] md:w-[420px] flex flex-col border-r border-white/10 bg-[#05080f] relative z-20 shrink-0 shadow-2xl h-full">
        <header className="px-5 py-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#05080f]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button onClick={onBackToHome} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all"><ChevronLeft size={18} /></button>
            <div className="flex flex-col">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#10b981]">Anya Core</h2>
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest italic">Always on the go</span>
            </div>
          </div>
          <button onClick={() => { setMessages([]); setHistory([]); setPreviewImage(null); }} className="p-2 hover:bg-red-500/10 rounded-xl text-slate-600 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
        </header>

        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-40 scroll-smooth"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-10 space-y-4 px-8 pt-20">
              <BrainCircuit size={48} />
              <p className="text-[11px] font-black uppercase tracking-[0.4em] leading-relaxed">Intelligence Online</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 relative group/msg ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-9 h-9 rounded-full shrink-0 border-2 overflow-hidden shadow-lg ${m.role === 'user' ? 'bg-[#10b981] border-[#10b981]/20 flex items-center justify-center' : 'border-[#10b981]/30 bg-slate-800'}`}>
                {m.role === 'user' ? <User size={16} className="text-[#05080f]" /> : <img src={ANYA_AVATAR_URL} className="w-full h-full object-cover" alt="Anya" />}
              </div>
              <div className={`flex flex-col gap-1.5 max-w-[85%] ${m.role === 'user' ? 'items-end' : ''}`}>
                <div className={`px-4 py-3 rounded-[1.2rem] text-[13px] leading-relaxed shadow-xl relative transition-all ${m.role === 'user' ? 'bg-[#10b981] text-white font-medium shadow-[#10b981]/10' : 'bg-[#0d1324] border border-white/5 text-slate-200'}`}>
                  {m.text}
                  {m.role === 'user' && (
                    <div className="absolute top-0 right-full mr-2 opacity-0 group-hover/msg:opacity-100 transition-opacity flex gap-1">
                      <button onClick={() => { setEditingMessageId(m.id); setInput(m.text); setPreviews(m.images || []); }} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white"><Edit2 size={12} /></button>
                      <button onClick={() => setMessages(prev => prev.filter(msg => msg.id !== m.id))} className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
                {m.images && m.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {m.images.map((img, idx) => (
                      <div key={idx} className="relative group/img-bubble rounded-2xl overflow-hidden border border-white/10 aspect-video shadow-2xl transition-transform hover:scale-[1.02]">
                        <img src={img} className="w-full h-full object-cover cursor-pointer" onClick={() => setPreviewImage(img)} />
                      </div>
                    ))}
                  </div>
                )}
                {m.grounding && m.grounding.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-2 bg-[#0a0f1d]/80 backdrop-blur p-3 rounded-2xl border border-white/10 w-full">
                    <span className="text-[8px] font-black uppercase text-blue-400 tracking-widest mb-1 flex items-center gap-1.5"><Search size={10} /> Research Data Found</span>
                    {m.grounding.map((g, idx) => (
                      <a key={idx} href={g.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded-lg text-[10px] text-slate-400 hover:text-white transition-all">
                        <span className="truncate pr-4">{g.title}</span>
                        <ExternalLink size={10} className="shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div className="h-4" />
          {isLoading && (
            <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#10b981]/30">
                <img src={ANYA_AVATAR_URL} className="w-full h-full object-cover grayscale opacity-50" alt="Anya" />
              </div>
              <div className="bg-[#0d1324] px-4 py-3 rounded-2xl text-[11px] text-slate-400 italic flex items-center gap-3 border border-white/5 shadow-lg">
                <Loader2 className="animate-spin text-[#10b981]" size={14} />
                <span>{loadingMsg}</span>
              </div>
            </div>
          )}
        </div>

        {/* Floating Input Dock */}
        <div className="absolute bottom-0 left-0 w-full p-4 bg-[#05080f]/98 border-t border-white/10 backdrop-blur-3xl z-40">
          {previews.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
              {previews.map((p, idx) => (
                <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-[#10b981]/40 shrink-0 shadow-2xl group/preview">
                  <img src={p} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/preview:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                    <button onClick={() => setEditingPreviewIdx(idx)} className="p-1 bg-white/10 rounded hover:bg-white/20"><Scissors size={10} /></button>
                    <button onClick={() => setPreviews(prev => prev.filter((_, i) => i !== idx))} className="p-1 bg-red-500/50 rounded hover:bg-red-600"><X size={10} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="relative mb-3 flex items-center gap-2">
             <button 
                onClick={() => { setShowMoods(!showMoods); setShowSettings(false); }} 
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${showMoods ? 'bg-[#10b981] text-[#05080f]' : 'bg-white/5 text-slate-500 hover:text-white'}`}
             >
               <Palette size={14} /> MOODS ({selectedModes.length > 0 ? selectedModes.length : 'AUTO'})
             </button>
             <button 
                onClick={() => { setShowSettings(!showSettings); setShowMoods(false); }} 
                className={`p-2.5 rounded-xl transition-all ${showSettings ? 'bg-[#10b981] text-[#05080f]' : 'bg-white/5 text-slate-500 hover:text-white'}`}
             >
               <Settings2 size={16} />
             </button>

             {showMoods && (
               <div className="absolute bottom-full left-0 w-full mb-3 bg-[#111827] border border-white/10 rounded-[2rem] p-4 shadow-2xl animate-in slide-in-from-bottom-2 z-50">
                  <div className="flex flex-col gap-2">
                    {[
                      { id: IntelligenceMode.CREATIVE, icon: Zap, label: 'Creative', color: 'text-yellow-500' },
                      { id: IntelligenceMode.RESEARCH, icon: Search, label: 'Web Search', color: 'text-blue-500' },
                      { id: IntelligenceMode.REASONING, icon: Lightbulb, label: 'Reasoning', color: 'text-[#10b981]' }
                    ].map(m => (
                      <button 
                        key={m.id} 
                        onClick={() => toggleMode(m.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all border ${selectedModes.includes(m.id) ? 'bg-[#10b981]/10 border-[#10b981] text-white' : 'bg-white/5 border-transparent text-slate-500 hover:text-slate-300'}`}
                      >
                        <m.icon size={16} className={m.color} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{m.label}</span>
                        {selectedModes.includes(m.id) && <Check size={14} className="ml-auto text-[#10b981]" />}
                      </button>
                    ))}
                    <button onClick={() => setSelectedModes([])} className="mt-2 text-[9px] font-black text-slate-700 uppercase hover:text-white transition-colors py-2">Clear Selection (Reasoning Default)</button>
                  </div>
               </div>
             )}

             {showSettings && (
               <div className="absolute bottom-full left-0 w-full mb-3 bg-[#111827] border border-white/10 rounded-[2rem] p-5 shadow-2xl animate-in slide-in-from-bottom-2 space-y-5 z-50">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase flex justify-between">Aspect Ratio <span className="text-[#10b981]">{settings.aspectRatio}</span></label>
                    <div className="grid grid-cols-4 gap-2">
                      {["1:1", "4:3", "3:4", "16:9"].map(r => (
                        <button key={r} onClick={() => onUpdateSettings({...settings, aspectRatio: r as ValidAspectRatio})} className={`py-2 text-[9px] font-black rounded-xl transition-all ${settings.aspectRatio === r ? 'bg-[#10b981] text-[#05080f]' : 'bg-white/5 text-slate-500 hover:text-white'}`}>{r}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">Context Sync <span>{Math.round(settings.strictness * 100)}%</span></div>
                    <input type="range" min="0" max="1" step="0.1" value={settings.strictness} onChange={(e) => onUpdateSettings({...settings, strictness: parseFloat(e.target.value)})} className="w-full h-1 bg-white/5 rounded-full appearance-none accent-[#10b981] cursor-pointer" />
                  </div>
               </div>
             )}
          </div>

          <div className="flex items-end gap-2 relative">
            <div className="flex-1 bg-white/5 rounded-2xl border border-white/5 p-2 focus-within:border-[#10b981]/50 transition-all relative shadow-inner overflow-hidden">
              <textarea 
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={editingMessageId ? "Editing turn..." : "Message Anya..."}
                className="w-full bg-transparent border-none focus:ring-0 text-[13px] p-2 text-slate-200 resize-none max-h-40 min-h-[48px] custom-scrollbar placeholder:text-slate-700"
              />
              <div className="flex items-center justify-between px-2 py-1 mt-1 border-t border-white/5">
                <div className="flex gap-1">
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-500 hover:text-[#10b981] transition-colors" title="Upload Image"><Upload size={18} /></button>
                  <button onClick={copyPrompt} className="p-2 text-slate-500 hover:text-[#10b981] transition-colors" title="Copy Prompt"><Copy size={18} /></button>
                </div>
                {editingMessageId && (
                  <button onClick={() => {setEditingMessageId(null); setInput('');}} className="text-[8px] text-white uppercase font-black px-3 py-1 bg-red-500/80 rounded-lg hover:bg-red-600 transition-colors">Abort Edit</button>
                )}
                <span className="text-[7px] font-black text-slate-800 uppercase tracking-widest italic flex items-center gap-1"><Zap size={10} /> Neural Stream</span>
              </div>
            </div>
            <button onClick={handleSend} disabled={isLoading} className="p-5 bg-[#10b981] text-[#05080f] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#10b981]/20 disabled:opacity-30">
              {editingMessageId ? <Check size={24} /> : <Send size={24} />}
            </button>
          </div>
          <input type="file" ref={fileInputRef} onChange={(e) => {
            const files = Array.from(e.target.files || []) as File[];
            files.forEach(file => {
              const reader = new FileReader();
              reader.onloadend = () => setPreviews(prev => [...prev, reader.result as string]);
              reader.readAsDataURL(file as Blob);
            });
            e.target.value = '';
          }} multiple accept="image/*" className="hidden" />
        </div>
      </div>

      {/* Right: Fixed Vision Preview Panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-10 bg-[#020408] relative overflow-hidden h-full">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.03)_0%,_transparent_75%)]" />
        
        <div className="w-full h-full flex items-center justify-center relative -mt-10">
          {previewImage || isLoading ? (
            <div className="relative group animate-in zoom-in-95 fade-in duration-700 max-w-full max-h-full flex items-center justify-center">
              <div className="relative rounded-[3rem] overflow-hidden border border-white/10 shadow-[0_50px_150px_rgba(0,0,0,1)] bg-slate-900/50">
                {previewImage && (
                  <img src={previewImage} className={`max-w-full max-h-[80vh] object-contain block transition-opacity duration-500 ${isLoading ? 'opacity-30 scale-95 blur-sm' : 'opacity-100'}`} />
                )}
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
                    <div className="relative w-24 h-24 mb-6"><div className="absolute inset-0 rounded-full border-4 border-white/5 border-t-[#10b981] animate-spin" /><div className="absolute inset-0 flex items-center justify-center"><Sparkles className="text-[#10b981] animate-pulse" size={32} /></div></div>
                    <span className="text-[14px] font-black text-white uppercase tracking-[0.2em] animate-pulse">{loadingMsg}</span>
                    <div className="w-48 h-1 bg-white/10 rounded-full mt-4 overflow-hidden"><div className="h-full bg-[#10b981] shadow-[0_0_10px_#10b981]" style={{ width: `${progress}%` }} /></div>
                  </div>
                )}
                {previewImage && !isLoading && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-6 z-30">
                    <button onClick={() => {const l=document.createElement('a'); l.href=previewImage; l.download='anya_gen.png'; l.click();}} className="flex flex-col items-center gap-2 p-6 bg-white/5 hover:bg-white/10 rounded-[2.5rem] text-slate-300 hover:text-white transition-all backdrop-blur-xl border border-white/10"><Download size={28} /><span className="text-[10px] font-black uppercase tracking-widest">Download</span></button>
                    <button onClick={() => window.open(previewImage, '_blank')} className="flex flex-col items-center gap-2 p-6 bg-white/5 hover:bg-[#10b981] rounded-[2.5rem] text-slate-300 hover:text-[#05080f] transition-all backdrop-blur-xl border border-white/10"><Maximize2 size={28} /><span className="text-[10px] font-black uppercase tracking-widest">View Full</span></button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-10 opacity-10 animate-pulse">
              <div className="w-32 h-32 border-[8px] border-dashed border-white/30 rounded-full flex items-center justify-center"><ImageIcon size={64} className="text-white" /></div>
              <span className="text-xl font-black uppercase tracking-[0.8em] text-white">Vision Pipeline</span>
            </div>
          )}
        </div>

        {/* Mini Archive & Seed Filter */}
        <div className="absolute bottom-10 left-10 right-10 flex flex-col gap-6 items-center">
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide justify-center items-center w-full max-w-4xl">
            <button onClick={() => setIsGalleryExpanded(true)} className="shrink-0 w-20 h-20 rounded-[1.5rem] bg-white/5 border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-slate-500 hover:border-[#10b981] hover:text-[#10b981] transition-all"><History size={20} /><span className="text-[8px] font-black uppercase mt-1">Archive</span></button>
            {gallery.slice(0, 6).map((item, idx) => (
              <button key={idx} onClick={() => setPreviewImage(item.url)} className={`shrink-0 w-20 h-20 rounded-[1.5rem] overflow-hidden border-2 transition-all hover:scale-110 active:scale-95 ${previewImage === item.url ? 'border-[#10b981] shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-110' : 'border-white/5 grayscale opacity-40 hover:opacity-100 hover:grayscale-0'}`}>
                <img src={item.url} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          <div className="bg-[#0d1324]/80 backdrop-blur-xl border border-white/5 p-3 rounded-[2rem] w-full max-w-2xl flex items-center gap-4 shadow-2xl">
             <div className="flex items-center gap-2 px-3 border-r border-white/5">
                <Search size={14} className="text-slate-600" />
                <input type="text" value={seedSearch} onChange={(e) => setSeedSearch(e.target.value)} placeholder="Filter seeds..." className="bg-transparent border-none focus:ring-0 text-[11px] font-black uppercase text-white placeholder:text-slate-800 w-32" />
             </div>
             <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
                {filteredSeeds.map(s => (
                  <button key={s.id} onClick={() => setInput(prev => prev + ` @${s.name.replace(/\s+/g, '')} `)} className="shrink-0 flex items-center gap-2 pl-1 pr-3 py-1 bg-white/5 border border-white/5 rounded-full hover:bg-white/10 transition-all">
                    <img src={s.imageData} className="w-6 h-6 rounded-full object-cover" />
                    <span className="text-[9px] font-black uppercase text-slate-300">@{s.name.replace(/\s+/g, '')}</span>
                  </button>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* Gallery Modal */}
      {isGalleryExpanded && (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-10 animate-in fade-in duration-300">
           <div className="w-full max-w-7xl h-full flex flex-col gap-8">
              <div className="flex justify-between items-center border-b border-white/5 pb-6">
                 <div className="flex flex-col gap-1">
                    <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-4"><History size={32} className="text-[#10b981]" /> Neural Archive</h3>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">Reviewing previous syntheses & latent logic</p>
                 </div>
                 <button onClick={() => setIsGalleryExpanded(false)} className="p-4 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all"><X size={32} /></button>
              </div>
              <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 custom-scrollbar pr-4">
                 {gallery.map((item, i) => (
                   <div key={i} className="group/gallery-item flex flex-col gap-4 bg-[#0a0f1d] p-5 rounded-[3rem] border border-white/5 hover:border-[#10b981]/30 transition-all">
                      <div className="relative aspect-video rounded-[2rem] overflow-hidden">
                        <img src={item.url} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/gallery-item:opacity-100 flex items-center justify-center gap-4 transition-all">
                           <button onClick={() => setSelectedGalleryItem(item)} className="p-3 bg-white/10 rounded-full hover:bg-white/20"><Info size={20} /></button>
                           <button onClick={() => { setPreviewImage(item.url); setIsGalleryExpanded(false); }} className="p-3 bg-[#10b981] text-[#05080f] rounded-full hover:scale-110"><Check size={20} /></button>
                        </div>
                      </div>
                      <p className="text-[11px] font-medium text-slate-400 line-clamp-2 italic">"{item.prompt}"</p>
                   </div>
                 ))}
              </div>
           </div>
           
           {/* Item Detail Modal */}
           {selectedGalleryItem && (
             <div className="fixed inset-0 z-[1100] bg-black/80 flex items-center justify-center p-12 animate-in zoom-in-95">
                <div className="bg-[#05080f] border border-white/10 rounded-[4rem] w-full max-w-5xl h-[80vh] flex overflow-hidden shadow-[0_0_100px_rgba(16,185,129,0.1)]">
                   <div className="flex-1 bg-black/40 flex items-center justify-center p-12">
                      <img src={selectedGalleryItem.url} className="max-w-full max-h-full object-contain rounded-3xl" />
                   </div>
                   <div className="w-[380px] border-l border-white/5 p-12 flex flex-col gap-8 bg-white/[0.02]">
                      <div className="flex justify-between items-start">
                        <div className="text-[10px] font-black text-[#10b981] uppercase tracking-widest">Synthesis Metadata</div>
                        <button onClick={() => setSelectedGalleryItem(null)} className="p-2 hover:bg-white/5 rounded-full"><X size={18} /></button>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Active Narrative</label>
                        <div className="p-5 bg-white/5 border border-white/5 rounded-3xl text-[12px] text-slate-300 leading-relaxed font-medium italic">"{selectedGalleryItem.prompt}"</div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Core Calibration</label>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 bg-white/5 rounded-2xl border border-white/5"><div className="text-[8px] text-slate-600 uppercase font-black">Entropy</div><div className="text-sm font-black text-white">{selectedGalleryItem.settings.temperature}</div></div>
                           <div className="p-4 bg-white/5 rounded-2xl border border-white/5"><div className="text-[8px] text-slate-600 uppercase font-black">Fidelity</div><div className="text-sm font-black text-white">{selectedGalleryItem.settings.faceFidelity}</div></div>
                           <div className="p-4 bg-white/5 rounded-2xl border border-white/5"><div className="text-[8px] text-slate-600 uppercase font-black">Strictness</div><div className="text-sm font-black text-white">{selectedGalleryItem.settings.strictness}</div></div>
                           <div className="p-4 bg-white/5 rounded-2xl border border-white/5"><div className="text-[8px] text-slate-600 uppercase font-black">Geometry</div><div className="text-sm font-black text-white">{selectedGalleryItem.settings.aspectRatio}</div></div>
                        </div>
                      </div>
                      <button onClick={() => { setInput(selectedGalleryItem.prompt); onUpdateSettings(selectedGalleryItem.settings); setSelectedGalleryItem(null); setIsGalleryExpanded(false); }} className="mt-auto py-5 bg-[#10b981] text-[#05080f] rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] transition-all"><RefreshCcw size={20} /> Restore Logic</button>
                   </div>
                </div>
             </div>
           )}
        </div>
      )}

      {/* Mini Image Editor Modal */}
      {editingPreviewIdx !== null && (
        <div className="fixed inset-0 z-[1200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-12">
           <div className="w-full max-w-4xl bg-[#05080f] border border-white/10 rounded-[4rem] flex flex-col overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                 <h4 className="text-xl font-black text-white uppercase italic tracking-tight flex items-center gap-3"><Scissors size={24} className="text-[#10b981]" /> Refine Pre-Stream</h4>
                 <button onClick={() => setEditingPreviewIdx(null)} className="p-2 hover:bg-white/5 rounded-full"><X size={24} /></button>
              </div>
              <div className="flex-1 flex min-h-0">
                 <div className="flex-1 bg-black/40 flex items-center justify-center p-12 relative overflow-hidden">
                    <img 
                      src={previews[editingPreviewIdx]} 
                      className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-transform" 
                      style={{ filter: `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%)`, transform: `rotate(${editorState.rotation}deg)` }} 
                    />
                    <canvas ref={canvasRef} className="hidden" />
                 </div>
                 <div className="w-72 border-l border-white/5 p-10 flex flex-col gap-10 bg-white/[0.02]">
                    <div className="space-y-6">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Calibration</label>
                       <div className="space-y-4">
                          <div className="flex justify-between text-[10px] text-slate-400 font-black"><span>Brightness</span><span>{editorState.brightness}%</span></div>
                          <input type="range" min="50" max="150" value={editorState.brightness} onChange={(e) => setEditorState({...editorState, brightness: parseInt(e.target.value)})} className="w-full accent-[#10b981] h-1 bg-white/5 rounded-full appearance-none" />
                          <div className="flex justify-between text-[10px] text-slate-400 font-black pt-2"><span>Contrast</span><span>{editorState.contrast}%</span></div>
                          <input type="range" min="50" max="150" value={editorState.contrast} onChange={(e) => setEditorState({...editorState, contrast: parseInt(e.target.value)})} className="w-full accent-[#10b981] h-1 bg-white/5 rounded-full appearance-none" />
                       </div>
                    </div>
                    <div className="space-y-6">
                       <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Geometry</label>
                       <button onClick={() => setEditorState({...editorState, rotation: (editorState.rotation + 90) % 360})} className="w-full py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black uppercase text-slate-400 flex items-center justify-center gap-3 hover:text-white transition-all"><RotateCw size={16} /> Rotate 90°</button>
                    </div>
                    <button onClick={applyEdits} className="mt-auto py-5 bg-[#10b981] text-[#05080f] rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] transition-all"><Check size={20} /> Commit Logic</button>
                 </div>
              </div>
           </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        
        ::selection { background: #10b981 !important; color: #000000 !important; }
        ::-moz-selection { background: #10b981 !important; color: #000000 !important; }
      `}} />
    </div>
  );
};

export default OnTheGoWorkspace;
