
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Message, AvatarSeed, GenSettings, ValidAspectRatio, IntelligenceMode, GalleryItem } from '../types.ts';
import { chatWithSearch, generateImage } from '../services/geminiService.ts';
import { 
  Send, Upload, X, Loader2, Sparkles, 
  ExternalLink, Maximize2, RefreshCcw, Download, 
  ChevronLeft, Trash2, BrainCircuit, User,
  Image as ImageIcon, Info,
  Edit2, Check, Search, Zap, Lightbulb,
  Settings2, Palette, Copy, Scissors, RotateCw, History, Fingerprint, PlusCircle
} from 'lucide-react';

interface Props {
  seeds: AvatarSeed[];
  settings: GenSettings;
  onUpdateSettings: (s: GenSettings) => void;
  onBackToHome: () => void;
  onAddSeed: (data: string, name: string, tags: string[]) => void;
  isKeySelected: boolean;
  gallery: GalleryItem[];
  onAddToGallery?: (url: string, promptText: string) => void;
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
  seeds, settings, onUpdateSettings, onBackToHome, onAddSeed, isKeySelected, gallery, onAddToGallery
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [lastSearchContext, setLastSearchContext] = useState<string>('');
  
  const [seedSearch, setSeedSearch] = useState('');
  
  const filteredSeeds = seeds.filter(s => 
    s.name.toLowerCase().includes(seedSearch.toLowerCase()) || 
    s.id.toLowerCase().includes(seedSearch.toLowerCase())
  );

  const [isGalleryExpanded, setIsGalleryExpanded] = useState(false);
  const [selectedGalleryItem, setSelectedGalleryItem] = useState<GalleryItem | null>(null);
  const [editingPreviewIdx, setEditingPreviewIdx] = useState<number | null>(null);
  const [editorState, setEditorState] = useState({ brightness: 100, contrast: 100, rotation: 0 });
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const progressTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

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
    
    // Add user message to UI
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: currentInput,
      images: currentPreviews
    };
    setMessages(prev => [...prev, userMessage]);
    
    setInput('');
    setPreviews([]);
    setIsLoading(true);

    try {
      const lowerInput = currentInput.toLowerCase();
      
      // INTENT 1: Action Request (e.g. Add as Seed)
      const isAddSeedAction = lowerInput.includes("add") && lowerInput.includes("seed") && (lowerInput.includes("identity") || lowerInput.includes("image"));
      
      // INTENT 2: Visual Modification/Generation
      const isNewRequest = /start over|new image|different person|reset/i.test(currentInput);
      const isTransformation = /convert|change|transform|style|make it|edit|modify|into/i.test(currentInput);
      const isGenerationRequest = /generate|create|render|make|change|add|put|swap|move|put|image|look like|draw|style/i.test(currentInput);

      if (isAddSeedAction) {
        // Handle System Action
        const sourceImage = currentPreviews.length > 0 ? currentPreviews[0] : previewImage;
        if (!sourceImage) {
          throw new Error("I don't see an image to save. Try generating one or uploading one first!");
        }

        // Extract name if provided
        let extractedName = "Unnamed Identity";
        const nameMatch = currentInput.match(/name (?:her|him|it|the seed) ([^.,!?]+)/i) || 
                          currentInput.match(/named? ([^.,!?]+)/i) ||
                          currentInput.match(/as ([^.,!?]+)/i);
        if (nameMatch) extractedName = nameMatch[nameMatch.length - 1].trim();

        onAddSeed(sourceImage, extractedName, ["anyacore", "vault"]);
        
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: `Neural link established! I've locked the identity "${extractedName}" into your Identity Vault. You can now use @${extractedName.replace(/\s+/g, '')} to maintain this face in future visions.`
        };
        setMessages(prev => [...prev, botMessage]);
        setIsLoading(false);
        return;
      }

      if (!isGenerationRequest) {
        // CONVERSATIONAL CHAT
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
      } 
      else {
        // IMAGE GENERATION
        let contextImages: string[] = [];
        contextImages.push(...currentPreviews);
        
        // Context persistence: use previous generation if transforming
        if (previewImage && !isNewRequest) {
          contextImages.push(previewImage);
        }

        seeds.forEach(s => {
          if (currentInput.includes(`@${s.name.replace(/\s+/g, '')}`)) {
            if (!contextImages.includes(s.imageData)) contextImages.push(s.imageData);
          }
        });

        let generationPrompt = currentInput;
        if (isTransformation && previewImage && !isNewRequest) {
          generationPrompt = `Update the current vision: ${currentInput}. Preserve the subject's face and basic structure from the provided reference image, but apply the requested transformation.`;
        }

        const response = await generateImage(generationPrompt, contextImages, {
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
          text: isTransformation ? "Latent weights shifted. New vision ready!" : "Here's the vision!",
          images: response.images
        };
        
        setMessages(prev => [...prev, botMessage]);
        
        if (response.images && response.images.length > 0) {
          const newImg = response.images[0];
          setPreviewImage(newImg);
          // Sync with global gallery
          if (onAddToGallery) {
            onAddToGallery(newImg, currentInput);
          }
        }
      }
    } catch (e: any) {
      if (e.message && e.message.includes("Requested entity was not found.")) {
        alert("Your Pro Key session has expired. Please re-select your key.");
      }
      const errorMsg = {
        id: Date.now().toString(),
        role: 'assistant' as const,
        text: "Neural processing failure: " + e.message
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(input);
  };

  const handleArchiveOpen = () => {
    setIsGalleryExpanded(true);
  };

  const handleSelectFromArchive = (item: GalleryItem) => {
    setPreviewImage(item.url);
    setIsGalleryExpanded(false);
  };

  return (
    <div className="flex h-screen w-full bg-[#020408] overflow-hidden">
      {/* Top Progress Bar */}
      <div className={`absolute top-0 left-0 w-full h-1 z-[100] transition-opacity duration-300 ${progress > 0 ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-full bg-[#10b981] shadow-[0_0_15px_#10b981] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Left: Chat Panel */}
      <div className="w-[360px] md:w-[420px] h-full flex flex-col border-r border-white/10 bg-[#05080f] shadow-2xl shrink-0 overflow-hidden relative z-20">
        
        <header className="px-5 py-5 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#05080f]">
          <div className="flex items-center gap-3">
            <button onClick={onBackToHome} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all"><ChevronLeft size={18} /></button>
            <div className="flex flex-col">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#10b981]">Anya Core</h2>
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest italic">Neural Studio</span>
            </div>
          </div>
          <button onClick={() => { setMessages([]); setHistory([]); setPreviewImage(null); }} className="p-2 hover:bg-red-500/10 rounded-xl text-slate-600 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
        </header>

        {/* PINNED IDENTITY VAULT - PERSISTENT HEADER */}
        <div className="shrink-0 bg-[#0d1324] border-b border-white/5 px-5 py-4 z-[45] flex flex-col gap-3 shadow-lg">
           <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                 <Fingerprint size={14} className="text-[#10b981]" /> Identity Vault
              </span>
              <button 
                onClick={handleArchiveOpen}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all flex items-center gap-2"
              >
                <History size={14} />
                <span className="text-[8px] font-black uppercase tracking-widest">Archive</span>
              </button>
           </div>
           <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1">
              {seeds.length > 0 ? seeds.map(s => (
                <button 
                   key={s.id} 
                   onClick={() => setInput(prev => prev + `@${s.name.replace(/\s+/g, '')} `)}
                   className="shrink-0 flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-full hover:bg-[#10b981]/10 hover:border-[#10b981]/50 transition-all group pr-3"
                >
                  <img src={s.imageData} className="w-7 h-7 rounded-full object-cover border border-white/10" />
                  <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-white">@{s.name.replace(/\s+/g, '')}</span>
                </button>
              )) : (
                <div className="flex items-center gap-3 text-slate-700 opacity-40">
                  <div className="w-7 h-7 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center"><PlusCircle size={12} /></div>
                  <span className="text-[9px] font-black uppercase tracking-widest italic">Vault Empty</span>
                </div>
              )}
           </div>
        </div>

        {/* Scrollable Message List */}
        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-scroll min-h-0 custom-scrollbar-permanent p-4 space-y-6"
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
                </div>
                {m.images && m.images.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 mt-1">
                    {m.images.map((img, idx) => (
                      <div key={idx} className="relative group/img-bubble rounded-2xl overflow-hidden border border-white/10 aspect-video shadow-2xl transition-transform hover:scale-[1.01]">
                        <img src={img} className="w-full h-full object-cover cursor-pointer" onClick={() => setPreviewImage(img)} />
                      </div>
                    ))}
                  </div>
                )}
                {m.grounding && m.grounding.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-2 bg-[#0a0f1d]/80 backdrop-blur p-3 rounded-2xl border border-white/10 w-full">
                    <span className="text-[8px] font-black uppercase text-blue-400 tracking-widest mb-1 flex items-center gap-1.5"><Search size={10} /> Neural Grounding</span>
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
          <div ref={messagesEndRef} className="h-4 shrink-0" />
        </div>

        {/* Input Dock */}
        <div className="p-4 bg-[#05080f] border-t border-white/10 shrink-0 z-40">
          {previews.length > 0 && (
            <div className="flex gap-3 mb-4 overflow-x-auto pb-2 scrollbar-hide bg-[#0d1324] p-3 rounded-2xl border border-white/5">
              {previews.map((p, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-[#10b981]/40 shrink-0 shadow-2xl group/preview">
                  <img src={p} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/preview:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                    <button onClick={() => setEditingPreviewIdx(idx)} className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20"><Scissors size={12} /></button>
                    <button onClick={() => setPreviews(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 bg-red-500/50 rounded-lg hover:bg-red-600"><X size={12} /></button>
                  </div>
                </div>
              ))}
              <div className="flex items-center px-2 text-[8px] font-black uppercase text-slate-600 tracking-widest whitespace-nowrap italic">Ready for stream</div>
            </div>
          )}

          <div className="relative mb-3 flex items-center gap-2">
             <button 
                onClick={() => { setShowMoods(!showMoods); setShowSettings(false); }} 
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${showMoods ? 'bg-[#10b981] text-[#05080f]' : 'bg-white/5 text-slate-500 hover:text-white'}`}
             >
               <Palette size={14} /> MOODS
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
                  </div>
               </div>
             )}

             {showSettings && (
               <div className="absolute bottom-full left-0 w-full mb-3 bg-[#111827] border border-white/10 rounded-[2rem] p-5 shadow-2xl animate-in slide-in-from-bottom-2 space-y-5 z-50">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase flex justify-between tracking-widest">Aspect Ratio <span className="text-[#10b981]">{settings.aspectRatio}</span></label>
                    <div className="grid grid-cols-4 gap-2">
                      {["1:1", "4:3", "3:4", "16:9"].map(r => (
                        <button key={r} onClick={() => onUpdateSettings({...settings, aspectRatio: r as ValidAspectRatio})} className={`py-2 text-[9px] font-black rounded-xl transition-all ${settings.aspectRatio === r ? 'bg-[#10b981] text-[#05080f]' : 'bg-white/5 text-slate-500 hover:text-white'}`}>{r}</button>
                      ))}
                    </div>
                  </div>
               </div>
             )}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 bg-white/5 rounded-2xl border border-white/10 p-2 focus-within:border-[#10b981]/50 transition-all relative overflow-hidden">
              <textarea 
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Talk to Anya or ask for a Vision..."
                className="w-full bg-transparent border-none focus:ring-0 text-[13px] p-2 text-slate-200 resize-none max-h-40 min-h-[48px] custom-scrollbar placeholder:text-slate-700"
              />
              <div className="flex items-center justify-between px-2 py-1 mt-1 border-t border-white/5">
                <div className="flex gap-1">
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-500 hover:text-[#10b981] transition-colors"><Upload size={18} /></button>
                  <button onClick={copyPrompt} className="p-2 text-slate-500 hover:text-[#10b981] transition-colors"><Copy size={18} /></button>
                </div>
                <span className="text-[7px] font-black text-slate-800 uppercase tracking-widest italic flex items-center gap-1"><Zap size={10} /> Neural Stream</span>
              </div>
            </div>
            <button onClick={handleSend} disabled={isLoading} className="p-5 bg-[#10b981] text-[#05080f] rounded-2xl hover:scale-105 transition-all shadow-xl shadow-[#10b981]/20 disabled:opacity-30">
              {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
            </button>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => {
              const fileList = e.target.files;
              if (!fileList) return;
              const files = Array.from(fileList) as File[];
              files.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  if (reader.result) {
                    setPreviews(prev => [...prev, reader.result as string]);
                  }
                };
                reader.readAsDataURL(file as Blob);
              });
              e.target.value = '';
            }} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />
        </div>
      </div>

      {/* Right: Vision Preview Panel */}
      <div className="flex-1 h-full flex flex-col items-center justify-center p-10 bg-[#020408] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.03)_0%,_transparent_75%)]" />
        
        <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden">
          {(previewImage || isLoading) ? (
            <div className="relative group animate-in zoom-in-95 fade-in duration-700 max-w-full max-h-full flex items-center justify-center">
              <div className="relative rounded-[3rem] overflow-hidden border border-white/10 shadow-[0_50px_150px_rgba(0,0,0,1)] bg-slate-900/50">
                {previewImage && (
                  <img 
                    key={previewImage} 
                    src={previewImage} 
                    className={`max-w-full max-h-[70vh] object-contain block transition-opacity duration-500 ${isLoading ? 'opacity-30 blur-sm scale-95' : 'opacity-100 scale-100'}`} 
                  />
                )}
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="relative w-24 h-24 mb-6">
                      <div className="absolute inset-0 rounded-full border-4 border-white/5 border-t-[#10b981] animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="text-[#10b981] animate-pulse" size={32} />
                      </div>
                    </div>
                    <span className="text-[14px] font-black text-white uppercase tracking-[0.2em] animate-pulse">{loadingMsg}</span>
                  </div>
                )}
                {previewImage && !isLoading && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-6 z-30">
                    <button onClick={() => {const l=document.createElement('a'); l.href=previewImage; l.download='anya_gen.png'; l.click();}} className="flex flex-col items-center gap-2 p-6 bg-white/5 hover:bg-white/10 rounded-[2.5rem] text-slate-300 hover:text-white transition-all backdrop-blur-xl border border-white/10"><Download size={28} /><span className="text-[10px] font-black uppercase tracking-widest">Download</span></button>
                    <button onClick={() => setIsFullscreenPreview(true)} className="flex flex-col items-center gap-2 p-6 bg-white/5 hover:bg-[#10b981] rounded-[2.5rem] text-slate-300 hover:text-[#05080f] transition-all backdrop-blur-xl border border-white/10"><Maximize2 size={28} /><span className="text-[10px] font-black uppercase tracking-widest">View Full</span></button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-10 opacity-10 animate-pulse">
              <div className="w-32 h-32 border-[8px] border-dashed border-white/30 rounded-full flex items-center justify-center">
                <ImageIcon size={64} className="text-white" />
              </div>
              <span className="text-xl font-black uppercase tracking-[0.8em] text-white">Vision Pipeline</span>
            </div>
          )}
        </div>

        <div className="shrink-0 w-full max-w-4xl py-6 flex flex-col gap-6 items-center">
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide justify-center items-center w-full">
            <button onClick={handleArchiveOpen} className="shrink-0 w-20 h-20 rounded-[1.5rem] bg-white/5 border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-slate-500 hover:border-[#10b981] hover:text-[#10b981] transition-all group">
               <History size={20} className="group-hover:rotate-12 transition-transform" />
               <span className="text-[8px] font-black uppercase mt-1">Archive</span>
            </button>
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

      {/* Fullscreen Preview Modal */}
      {isFullscreenPreview && previewImage && (
        <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in duration-300">
           <button onClick={() => setIsFullscreenPreview(false)} className="absolute top-10 right-10 p-4 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all z-[2010]"><X size={32} /></button>
           <div className="relative max-w-full max-h-full flex flex-col items-center gap-8">
              <img src={previewImage} className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/5" />
              <div className="flex items-center gap-4">
                 <button onClick={() => {const l=document.createElement('a'); l.href=previewImage; l.download='anya_gen.png'; l.click();}} className="px-8 py-4 bg-white/5 text-white border border-white/10 font-black uppercase tracking-widest rounded-2xl flex items-center gap-3 hover:bg-white/10 transition-all"><Download size={20} /> Download</button>
                 <button onClick={() => {setPreviews(prev => [...prev, previewImage]); setIsFullscreenPreview(false);}} className="px-8 py-4 bg-white/5 text-white border border-white/10 font-black uppercase tracking-widest rounded-2xl flex items-center gap-3 hover:bg-[#10b981]/10 hover:text-[#10b981] transition-all"><RefreshCcw size={20} /> Reuse Reference</button>
                 <button onClick={() => {setEditingPreviewIdx(0); setPreviews([previewImage]); setIsFullscreenPreview(false);}} className="px-8 py-4 bg-[#10b981] text-[#05080f] font-black uppercase tracking-widest rounded-2xl flex items-center gap-3 hover:scale-105 transition-all"><Scissors size={20} /> Refine/Edit</button>
              </div>
           </div>
        </div>
      )}

      {/* Archive Modal */}
      {isGalleryExpanded && (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-10 animate-in fade-in duration-300">
           <div className="w-full max-w-7xl h-full flex flex-col gap-8">
              <div className="flex justify-between items-center border-b border-white/5 pb-6">
                 <div className="flex flex-col gap-1">
                    <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-4"><History size={32} className="text-[#10b981]" /> Neural Archive</h3>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">Browsing previous latent states</p>
                 </div>
                 <button onClick={() => setIsGalleryExpanded(false)} className="p-4 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all"><X size={32} /></button>
              </div>
              <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 custom-scrollbar-permanent pr-4">
                 {gallery.map((item, i) => (
                   <div key={i} className="group/gallery-item flex flex-col gap-4 bg-[#0a0f1d] p-5 rounded-[3rem] border border-white/5 hover:border-[#10b981]/30 transition-all">
                      <div className="relative aspect-video rounded-[2rem] overflow-hidden">
                        <img src={item.url} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/gallery-item:opacity-100 flex items-center justify-center gap-4 transition-all">
                           <button onClick={() => handleSelectFromArchive(item)} className="p-3 bg-[#10b981] text-[#05080f] rounded-full hover:scale-110 shadow-xl"><Check size={20} /></button>
                           <button onClick={() => {setPreviewImage(item.url); setIsFullscreenPreview(true);}} className="p-3 bg-white/10 rounded-full hover:bg-white/20"><Maximize2 size={20} /></button>
                        </div>
                      </div>
                      <p className="text-[11px] font-medium text-slate-400 line-clamp-2 italic">"{item.prompt}"</p>
                   </div>
                 ))}
                 {gallery.length === 0 && (
                   <div className="col-span-full h-64 flex flex-col items-center justify-center text-slate-700 opacity-40">
                     <History size={48} />
                     <p className="text-sm font-black uppercase mt-4">Archive is empty</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar-permanent::-webkit-scrollbar { 
          width: 10px; 
          display: block !important;
        }
        .custom-scrollbar-permanent::-webkit-scrollbar-track { 
          background: #020617; 
        }
        .custom-scrollbar-permanent::-webkit-scrollbar-thumb { 
          background: #1e293b; 
          border-radius: 10px;
          border: 3px solid #020617;
        }
        .custom-scrollbar-permanent::-webkit-scrollbar-thumb:hover { 
          background: #10b981; 
        }

        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        
        ::selection { background: #10b981 !important; color: #000000 !important; }
      `}} />
    </div>
  );
};

export default OnTheGoWorkspace;
