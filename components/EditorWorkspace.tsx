import React, { useState, useEffect, useRef } from 'react';
import { AppMode, GenSettings, AvatarSeed, ValidAspectRatio, ValidImageSize } from '../types.ts';
import { rewritePrompt } from '../services/geminiService.ts';
import { 
  Wand2, Loader2, Image as ImageIcon, Plus, 
  Hash, Sparkles, ChevronLeft, AtSign,
  Zap, Maximize2, MoreVertical, Trash2, 
  Check, Scissors, Camera, FileUp, Ban, BrainCircuit, RotateCw, Download, X,
  Thermometer, ShieldCheck, Layers, Layout, Monitor, Undo2, Redo2, History, Target,
  RefreshCcw, Edit3, Minimize2
} from 'lucide-react';

interface Props {
  mode: AppMode;
  settings: GenSettings;
  negativePrompt: string;
  prompt: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onUpdatePrompt: (p: string) => void;
  onCommitPrompt: (p: string) => void;
  neuralMemory: string;
  onUpdateSettings: (s: GenSettings) => void;
  onUpdateNegativePrompt: (np: string) => void;
  onGenerate: (prompt: string, images: string[], determinedRatio?: string) => void;
  isLoading: boolean;
  previewImage: string | null;
  onSelectFromGallery: (img: string) => void;
  gallery: string[];
  seeds: AvatarSeed[];
  onBackToHome: () => void;
  onRemoveSeed: (id: string) => void;
  onRenameSeed: (id: string, newName: string) => void;
}

const EditorWorkspace: React.FC<Props> = ({ 
  mode, settings, negativePrompt, prompt, canUndo, canRedo, onUndo, onRedo,
  onUpdatePrompt, onCommitPrompt, neuralMemory, onUpdateSettings, 
  onUpdateNegativePrompt, onGenerate, isLoading, previewImage, 
  onSelectFromGallery, gallery, seeds, onBackToHome, onRemoveSeed, onRenameSeed
}) => {
  // Expanded to 13 slots
  const [uploadedImages, setUploadedImages] = useState<string[]>(new Array(13).fill(''));
  const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPromptFullscreen, setIsPromptFullscreen] = useState(false);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
  const [seedPreviewUrl, setSeedPreviewUrl] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeSourceMenuIdx, setActiveSourceMenuIdx] = useState<number | null>(null);
  const [uploadSlotIdx, setUploadSlotIdx] = useState<number | null>(null);
  // Default combo now 13
  const [sourceSlotsCount, setSourceSlotsCount] = useState<number>(mode === AppMode.SINGLE_PLAY ? 1 : 13);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [progress, setProgress] = useState(0);

  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editorRotation, setEditorRotation] = useState(0);
  const [editorFlipH, setEditorFlipH] = useState(false);
  const [editorBrightness, setEditorBrightness] = useState(100);
  const [editorContrast, setEditorContrast] = useState(100);
  
  const progressTimerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fullscreenTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorCanvasRef = useRef<HTMLCanvasElement>(null);
  const promptCommitTimer = useRef<number | null>(null);

  useEffect(() => {
    if (seeds.length > 0 && !selectedSeedId) {
      setSelectedSeedId(seeds[0].id);
    }
  }, [seeds, selectedSeedId]);

  useEffect(() => {
    if (isLoading) {
      setProgress(5);
      progressTimerRef.current = window.setInterval(() => {
        setProgress(prev => {
          if (prev < 90) return prev + Math.random() * 3;
          if (prev < 99) return prev + 0.1;
          return prev;
        });
      }, 200);
    } else {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (progress > 0) {
        setProgress(100);
        setTimeout(() => setProgress(0), 1000);
      }
    }
    return () => { if (progressTimerRef.current) clearInterval(progressTimerRef.current); };
  }, [isLoading]);

  const openEditor = (dataUrl: string, idx: number) => {
    setEditingImage(dataUrl);
    setUploadSlotIdx(idx);
    setEditorRotation(0);
    setEditorFlipH(false);
    setEditorBrightness(100);
    setEditorContrast(100);
    setActiveSourceMenuIdx(null);
  };

  const finalizeEditing = () => {
    if (!editorCanvasRef.current || !editingImage || uploadSlotIdx === null) return;
    const canvas = editorCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const is90 = editorRotation % 180 !== 0;
      canvas.width = is90 ? img.height : img.width;
      canvas.height = is90 ? img.width : img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.filter = `brightness(${editorBrightness}%) contrast(${editorContrast}%)`;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((editorRotation * Math.PI) / 180);
      if (editorFlipH) ctx.scale(-1, 1);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
      const finalDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setUploadedImages(prev => {
        const next = [...prev];
        next[uploadSlotIdx!] = finalDataUrl;
        return next;
      });
      setEditingImage(null);
      setUploadSlotIdx(null);
    };
    img.src = editingImage;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadSlotIdx !== null) {
      const reader = new FileReader();
      reader.onloadend = () => { if (reader.result) openEditor(reader.result as string, uploadSlotIdx); };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    onUpdatePrompt(value);
    if (promptCommitTimer.current) window.clearTimeout(promptCommitTimer.current);
    promptCommitTimer.current = window.setTimeout(() => onCommitPrompt(value), 1000);
    const textBeforeCursor = value.substring(0, position);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt !== -1) {
      const segment = textBeforeCursor.substring(lastAt);
      if (!segment.includes(' ') && !segment.includes('\n')) {
        setShowMentions(true);
        setMentionFilter(segment.substring(1).toLowerCase());
      } else { setShowMentions(false); }
    } else { setShowMentions(false); }
  };

  const insertMention = (mention: string) => {
    const activeRef = isPromptFullscreen ? fullscreenTextareaRef : textareaRef;
    if (!activeRef.current) return;
    const position = activeRef.current.selectionStart;
    const textBefore = prompt.substring(0, position);
    const lastAt = textBefore.lastIndexOf('@');
    if (lastAt !== -1) {
      const newPrompt = prompt.substring(0, lastAt) + '@' + mention + ' ' + prompt.substring(position);
      onUpdatePrompt(newPrompt);
      onCommitPrompt(newPrompt);
      setShowMentions(false);
      setTimeout(() => {
        activeRef.current?.focus();
        const newCursorPos = lastAt + mention.length + 2;
        activeRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  const handleSurpriseMe = async () => {
    if (!prompt.trim() || isRewriting) return;
    setIsRewriting(true);
    try {
      const betterPrompt = await rewritePrompt(prompt, neuralMemory);
      onUpdatePrompt(betterPrompt);
      onCommitPrompt(betterPrompt);
    } catch (e) { } finally { setIsRewriting(false); }
  };

  const handleReuseOutput = (dataUrl: string) => {
    // Find first empty slot or overwrite slot 1
    const emptyIdx = uploadedImages.findIndex(img => !img);
    const targetIdx = emptyIdx !== -1 ? emptyIdx : 0;
    setUploadedImages(prev => {
      const next = [...prev];
      next[targetIdx] = dataUrl;
      return next;
    });
  };

  const detectAspectRatio = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        if (ratio > 1.6) resolve("16:9");
        else if (ratio < 0.6) resolve("9:16");
        else if (ratio > 0.9 && ratio < 1.1) resolve("1:1");
        else resolve(ratio > 1 ? "4:3" : "3:4");
      };
      img.src = dataUrl;
    });
  };

  const handleMagicClick = async () => {
    if (!prompt.trim() && uploadedImages.filter(Boolean).length === 0) return;
    let finalImages: string[] = [];
    let processedPrompt = prompt;
    for (let i = 0; i < uploadedImages.length; i++) {
      const tag = `@image${i+1}`;
      if (processedPrompt.includes(tag) && uploadedImages[i]) {
        processedPrompt = processedPrompt.replace(new RegExp(tag, 'g'), `[REFERENCE_PHOTO_${i+1}]`);
        finalImages.push(uploadedImages[i]);
      }
    }
    uploadedImages.forEach((img) => { if (img && !finalImages.includes(img)) finalImages.push(img); });
    seeds.forEach(s => {
      const mentionTag = `@${s.name.replace(/\s+/g, '')}`;
      if (processedPrompt.includes(mentionTag)) {
        processedPrompt = processedPrompt.replace(new RegExp(mentionTag, 'g'), `[IDENTITY_LOCK: ${s.id}]`);
        if (!finalImages.includes(s.imageData)) finalImages.push(s.imageData);
      }
    });
    const currentSeed = seeds.find(s => s.id === selectedSeedId);
    if (currentSeed && !finalImages.includes(currentSeed.imageData)) finalImages.unshift(currentSeed.imageData);
    let finalRatio: string = settings.aspectRatio;
    if (finalRatio === "Original" && uploadedImages.find(i => i)) finalRatio = await detectAspectRatio(uploadedImages.find(i => i)!);
    else if (finalRatio === "Original") finalRatio = "1:1";
    onGenerate(processedPrompt, finalImages, finalRatio);
  };

  const isGenerateDisabled = isLoading || (!prompt.trim() && uploadedImages.filter(Boolean).length === 0 && !selectedSeedId);
  const filteredImageMentions = Array.from({ length: sourceSlotsCount }, (_, i) => `image${i + 1}`).filter(tag => tag.toLowerCase().includes(mentionFilter));
  const filteredSeeds = seeds.filter(s => s.name.toLowerCase().includes(mentionFilter));
  const aspectRatios: (ValidAspectRatio | "Original")[] = ["Original", "1:1", "4:3", "3:4", "16:9", "9:16"];
  const imageSizes: ValidImageSize[] = ["1K", "2K", "4K"];

  return (
    <div className="flex h-full w-full overflow-hidden font-sans bg-[#020408]">
      <aside className="w-[420px] bg-[#05080f] border-r border-white/5 flex flex-col h-full z-10 shadow-2xl relative shrink-0">
        <div className="absolute inset-0 overflow-y-auto custom-sidebar overflow-x-hidden">
          <div className="p-8 space-y-12 flex flex-col min-h-fit pb-12">
            
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={onBackToHome} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-[11px] font-black uppercase tracking-widest border border-white/5">
                  <ChevronLeft size={16} /> Back
                </button>
                <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/5">
                   <button disabled={!canUndo} onClick={onUndo} className="p-2 text-slate-400 hover:text-white disabled:opacity-20 transition-all hover:bg-white/5 rounded-lg" title="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
                   <button disabled={!canRedo} onClick={onRedo} className="p-2 text-slate-400 hover:text-white disabled:opacity-20 transition-all hover:bg-white/5 rounded-lg" title="Redo (Ctrl+Shift+Z)"><Redo2 size={16} /></button>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black tracking-[0.3em] text-yellow-500 uppercase mb-0.5">Neural Engine</div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight italic">{mode.replace('_', ' ')}</h3>
              </div>
            </div>

            <div className="space-y-6 shrink-0 relative">
              <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]">
                <Hash size={14} className="text-yellow-500" /> Identity Seeds
              </label>
              <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x px-2 overflow-y-visible">
                {seeds.length > 0 ? seeds.map(s => (
                  <div key={s.id} className="relative shrink-0 snap-center group/seed-card overflow-visible">
                    <button onClick={() => setSelectedSeedId(s.id === selectedSeedId ? null : s.id)} className={`relative w-24 h-24 rounded-2xl overflow-hidden border-[4px] transition-all transform ${selectedSeedId === s.id ? 'border-yellow-500 scale-105 shadow-[0_0_30px_rgba(234,179,8,0.4)]' : 'border-[#1e293b] opacity-60 hover:opacity-100 hover:border-yellow-500/50'}`}>
                      <img src={s.imageData} className="w-full h-full object-cover" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === s.id ? null : s.id); }} className="absolute bottom-1 right-1 bg-[#0d1324] text-slate-400 hover:text-white p-1.5 rounded-full border border-white/10 opacity-0 group-hover/seed-card:opacity-100 transition-opacity z-[60]"><MoreVertical size={14} /></button>
                    {activeMenuId === s.id && (
                      <div className="absolute top-1/2 left-full ml-4 -translate-y-1/2 w-44 bg-[#111827] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[999] animate-in fade-in slide-in-from-left-4">
                         <button onClick={() => { setSeedPreviewUrl(s.imageData); setIsFullscreen(true); setActiveMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-slate-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest border-b border-white/5"><Maximize2 size={14} /> View Master</button>
                         <button onClick={() => { onRemoveSeed(s.id); setActiveMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-500 transition-colors text-[10px] font-black uppercase tracking-widest"><Trash2 size={14} /> Remove</button>
                      </div>
                    )}
                    <div className="mt-2 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center truncate w-24">{s.name}</div>
                  </div>
                )) : (
                  <div className="w-full py-8 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-20 flex flex-col items-center gap-2"><Hash size={24} /><span className="text-[9px] font-black uppercase">No seeds active</span></div>
                )}
              </div>
            </div>

            <div className="space-y-4 shrink-0">
               <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]">
                    <ImageIcon size={14} className="text-yellow-500" /> Source Photometry
                  </label>
                  <div className="flex bg-[#0a0f1d] p-1 rounded-xl border border-white/5">
                    <button onClick={() => { setSourceSlotsCount(1); onUpdateSettings({...settings, aspectRatio: "Original"}); }} className={`px-4 py-1 rounded-lg text-[9px] font-black transition-all ${sourceSlotsCount === 1 ? 'bg-yellow-500 text-[#05080f]' : 'text-slate-500'}`}>SOLO</button>
                    <button onClick={() => setSourceSlotsCount(13)} className={`px-4 py-1 rounded-lg text-[9px] font-black transition-all ${sourceSlotsCount > 1 ? 'bg-yellow-500 text-[#05080f]' : 'text-slate-500'}`}>COMBO</button>
                  </div>
               </div>
               <div className={`grid ${sourceSlotsCount === 1 ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
                  {[...Array(sourceSlotsCount)].map((_, i) => (
                    <div key={i} className="relative group/source-container">
                      <button 
                        onClick={() => uploadedImages[i] ? openEditor(uploadedImages[i], i) : setUploadSlotIdx(i)} 
                        className={`aspect-square w-full bg-slate-800/10 border border-white/5 rounded-[1.5rem] flex items-center justify-center hover:border-yellow-500/30 transition-all overflow-hidden relative ${sourceSlotsCount === 1 ? 'max-w-[200px] mx-auto rounded-[3rem]' : ''}`}
                      >
                        {uploadedImages[i] ? (
                          <><img src={uploadedImages[i]} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover/source:opacity-100 flex items-center justify-center transition-opacity"><Scissors size={sourceSlotsCount === 1 ? 32 : 20} className="text-white" /></div></>
                        ) : (
                          <div className="flex flex-col items-center gap-1 opacity-20 group-hover/source:opacity-100 transition-opacity"><Plus size={sourceSlotsCount === 1 ? 32 : 18} /><span className="text-[7px] font-black uppercase">Slot {i+1}</span></div>
                        )}
                      </button>
                      
                      {uploadedImages[i] && (
                        <div className="absolute top-2 right-2 z-20">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveSourceMenuIdx(activeSourceMenuIdx === i ? null : i); }}
                            className="bg-[#05080f]/80 backdrop-blur-md p-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all opacity-0 group-hover/source-container:opacity-100"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {activeSourceMenuIdx === i && (
                            <div className="absolute top-full right-0 mt-2 w-32 bg-[#111827] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in fade-in zoom-in-95">
                               <button onClick={() => openEditor(uploadedImages[i], i)} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 text-slate-400 hover:text-white transition-colors text-[9px] font-black uppercase tracking-widest border-b border-white/5"><Edit3 size={12} /> Edit</button>
                               <button onClick={() => { setUploadSlotIdx(i); setActiveSourceMenuIdx(null); }} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 text-slate-400 hover:text-white transition-colors text-[9px] font-black uppercase tracking-widest border-b border-white/5"><RefreshCcw size={12} /> Replace</button>
                               <button onClick={() => { setUploadedImages(prev => { const n = [...prev]; n[i] = ''; return n; }); setActiveSourceMenuIdx(null); }} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-red-500/10 text-red-500 transition-colors text-[9px] font-black uppercase tracking-widest"><Trash2 size={12} /> Clear</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
               </div>
            </div>

            <div className="space-y-6 shrink-0 relative">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    Neural Narrative
                  </label>
                  <span className="text-[9px] text-slate-600 font-bold uppercase flex items-center gap-1 opacity-50"><AtSign size={12} /> Tags Active</span>
                </div>
                <div className="relative group/prompt overflow-visible rounded-[2.5rem]">
                  {isRewriting && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center space-y-3 pointer-events-none animate-in fade-in duration-500">
                      <div className="absolute inset-0 bg-[#0a0f1d]/90 backdrop-blur-md rounded-[2.5rem]" />
                      <BrainCircuit size={32} className="text-yellow-500 animate-pulse relative z-30" />
                      <span className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.4em] relative z-30">Reweaving Logic</span>
                    </div>
                  )}
                  <textarea 
                    ref={textareaRef} 
                    value={prompt} 
                    onChange={handlePromptChange} 
                    onBlur={() => onCommitPrompt(prompt)} 
                    placeholder="Describe your vision... @image1 @seed_name" 
                    className="w-full h-40 bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-6 pr-14 text-sm text-slate-200 placeholder:text-slate-800 focus:outline-none focus:border-yellow-500/50 transition-all resize-none custom-scrollbar" 
                  />
                  <button 
                    onClick={() => setIsPromptFullscreen(true)}
                    className="absolute bottom-6 right-6 p-2.5 bg-white/5 hover:bg-yellow-500/20 text-slate-500 hover:text-yellow-500 rounded-xl transition-all border border-white/5 z-30"
                    title="Full-screen Editing"
                  >
                    <Maximize2 size={18} />
                  </button>
                  {showMentions && (
                    <div className="absolute bottom-full left-0 w-full mb-4 bg-[#0d1324] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden z-[9999] animate-in slide-in-from-bottom-4">
                       <div className="px-5 py-3 border-b border-white/5 bg-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Select Reference</div>
                       <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {/* Identity Seeds moved to the top */}
                        {filteredSeeds.map(s => (<button key={s.id} onClick={() => insertMention(s.name.replace(/\s+/g, ''))} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 text-left border-b border-white/5 transition-colors"><img src={s.imageData} className="w-8 h-8 rounded object-cover border border-white/10" /><span className="text-[11px] font-black text-white uppercase tracking-widest">@{s.name.replace(/\s+/g, '')}</span></button>))}
                        {filteredImageMentions.map((tag) => (<button key={tag} onClick={() => insertMention(tag)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 text-left border-b border-white/5 transition-colors group/mention"><div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-slate-500 group-hover/mention:text-yellow-500 transition-colors"><ImageIcon size={14} /></div><span className="text-[11px] font-black text-white uppercase tracking-widest">@{tag}</span></button>))}
                       </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Ban size={12} className="text-red-500/50" /> Exclusion Logic</label>
                  <input type="text" value={negativePrompt} onChange={(e) => onUpdateNegativePrompt(e.target.value)} placeholder="Things to avoid... e.g. text, blurry, distortion" className="w-full bg-[#0a0f1d] border border-white/5 rounded-2xl px-5 py-3 text-xs text-slate-300 focus:outline-none focus:border-red-500/30 transition-all" />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={handleSurpriseMe} disabled={isRewriting || !prompt.trim()} className="flex items-center gap-3 px-8 py-4 bg-[#0a0f1d] hover:bg-yellow-500/10 text-slate-500 hover:text-yellow-500 rounded-3xl border border-white/10 transition-all group">
                    <Zap size={18} className="group-hover:fill-yellow-500 transition-all" />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em]">Enhance Prompt</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-8 bg-yellow-500/5 p-6 rounded-[2.5rem] border border-yellow-500/10">
              <div className="flex items-center gap-3">
                 <BrainCircuit size={18} className="text-yellow-500" />
                 <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Neural Core Config</span>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Layout size={12} /> Frame Geometry</label>
                  <div className="grid grid-cols-3 gap-2">
                    {aspectRatios.map(ratio => (<button key={ratio} onClick={() => onUpdateSettings({...settings, aspectRatio: ratio})} className={`py-2 text-[10px] font-black rounded-lg transition-all border ${settings.aspectRatio === ratio ? 'bg-yellow-500 border-yellow-500 text-[#05080f] shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-[#0d1324] border-white/5 text-slate-500 hover:text-white hover:border-white/10'}`}>{ratio}</button>))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Monitor size={12} /> Fidelity Level</label>
                  <div className="flex bg-[#0d1324] p-1 rounded-xl border border-white/5">
                    {imageSizes.map(size => (<button key={size} onClick={() => onUpdateSettings({...settings, imageSize: size})} className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${settings.imageSize === size ? 'bg-white/10 text-white shadow-xl' : 'text-slate-600 hover:text-slate-400'}`}>{size}</button>))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Thermometer size={12} /> Entropy (Temp)</label><span className="text-[10px] font-black text-yellow-500">{settings.temperature.toFixed(2)}</span></div>
                    <input type="range" min="0.1" max="1.5" step="0.05" value={settings.temperature} onChange={(e) => onUpdateSettings({...settings, temperature: parseFloat(e.target.value)})} className="w-full h-1 bg-[#0d1324] rounded-full appearance-none accent-yellow-500 cursor-pointer" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={12} /> Biometric Lock</label><span className="text-[10px] font-black text-yellow-500">{Math.round(settings.faceFidelity * 100)}%</span></div>
                    {/* Fixed typo 'setOnUpdateSettings' to 'onUpdateSettings' */}
                    <input type="range" min="0" max="1" step="0.05" value={settings.faceFidelity} onChange={(e) => onUpdateSettings({...settings, faceFidelity: parseFloat(e.target.value)})} className="w-full h-1 bg-[#0d1324] rounded-full appearance-none accent-yellow-500 cursor-pointer" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Target size={12} /> Prompt Strictness</label><span className="text-[10px] font-black text-yellow-500">{Math.round(settings.strictness * 100)}%</span></div>
                    <input type="range" min="0" max="1" step="0.05" value={settings.strictness} onChange={(e) => onUpdateSettings({...settings, strictness: parseFloat(e.target.value)})} className="w-full h-1 bg-[#0d1324] rounded-full appearance-none accent-yellow-500 cursor-pointer" />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-4">
                  <div className="flex items-center gap-3 mb-2"><Camera size={14} className="text-yellow-500" /><span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Lens & Posture</span></div>
                  <div className="grid grid-cols-1 gap-2">
                    <select value={settings.cameraAngle} onChange={(e) => onUpdateSettings({...settings, cameraAngle: e.target.value})} className="w-full bg-[#0d1324] border border-white/5 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-slate-300 focus:outline-none focus:border-yellow-500/50 appearance-none"><option value="Default">Auto Angle</option><option value="Close-up">Close-up</option><option value="Wide angle">Wide Angle</option><option value="Low angle">Low Angle</option><option value="Dutch angle">Dutch Angle</option></select>
                    <select value={settings.pose} onChange={(e) => onUpdateSettings({...settings, pose: e.target.value})} className="w-full bg-[#0d1324] border border-white/5 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-slate-300 focus:outline-none focus:border-yellow-500/50 appearance-none"><option value="Default">Auto Pose</option><option value="Fashion editorial">Fashion editorial</option><option value="Relaxed sitting">Relaxed sitting</option><option value="Power stance">Power stance</option></select>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 shrink-0">
              <button disabled={isGenerateDisabled} onClick={handleMagicClick} className={`w-full py-8 font-black rounded-[3rem] shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.97] ${isGenerateDisabled ? 'bg-slate-800 text-slate-600' : 'bg-yellow-500 hover:bg-yellow-400 text-[#05080f]'}`}>
                {isLoading ? <Loader2 className="animate-spin" /> : <><Wand2 size={24} /> <span className="uppercase text-lg tracking-[0.1em]">Synthesize Reality</span></>}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 relative flex flex-col items-center justify-center p-12 overflow-hidden bg-[#020408]">
        <div className={`absolute top-0 left-0 w-full h-1.5 z-[100] transition-all duration-700 ${isLoading ? 'opacity-100' : 'opacity-0'}`}><div className="h-full bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,1)] transition-all duration-300 ease-out" style={{ width: `${progress}%` }} /></div>

        {isLoading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#020408]/90 backdrop-blur-xl animate-in fade-in duration-500">
             <div className="relative flex flex-col items-center gap-10">
                <div className="relative w-40 h-40 flex items-center justify-center">
                   <div className="absolute inset-0 rounded-full border-[8px] border-white/5 border-t-yellow-500 animate-spin" /><BrainCircuit size={64} className="text-yellow-500 animate-pulse" />
                </div>
                <div className="flex flex-col items-center gap-3 text-center">
                   <h4 className="text-2xl font-black text-white uppercase tracking-[0.4em] animate-pulse">Processing Neural Rigs</h4>
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em]">Assembling Latent Vectors... {Math.round(progress)}%</p>
                </div>
             </div>
          </div>
        )}

        <div className="flex-1 w-full flex flex-col items-center justify-center overflow-hidden">
          {previewImage ? (
            <div className="relative flex flex-col items-center animate-in fade-in zoom-in duration-1000 group">
              <div className="relative rounded-[4rem] overflow-hidden shadow-[0_60px_120px_rgba(0,0,0,1)] border border-white/5">
                <img src={previewImage} className="max-h-[60vh] md:max-h-[70vh] w-auto object-contain" />
                
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2.5 bg-[#0a0f1d]/90 backdrop-blur-3xl rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 border border-white/10 shadow-2xl">
                   <button onClick={() => {setFullscreenImageUrl(previewImage); setIsFullscreen(true);}} className="p-4 bg-white/5 hover:bg-white/10 rounded-3xl text-slate-300 hover:text-white transition-all flex flex-col items-center gap-1" title="Fullscreen">
                    <Maximize2 size={20} />
                    <span className="text-[8px] font-black uppercase tracking-tighter">View</span>
                   </button>
                   <button onClick={() => openEditor(previewImage, 0)} className="p-4 bg-white/5 hover:bg-white/10 rounded-3xl text-slate-300 hover:text-white transition-all flex flex-col items-center gap-1" title="Refine in Editor">
                    <Edit3 size={20} />
                    <span className="text-[8px] font-black uppercase tracking-tighter">Edit</span>
                   </button>
                   <button onClick={() => handleReuseOutput(previewImage)} className="p-4 bg-yellow-500 text-[#05080f] hover:bg-yellow-400 rounded-3xl transition-all flex flex-col items-center gap-1" title="Reuse as Source Slot">
                    <RefreshCcw size={20} />
                    <span className="text-[8px] font-black uppercase tracking-tighter">Reuse</span>
                   </button>
                   <button onClick={() => {const l=document.createElement('a'); l.href=previewImage; l.download='banana.png'; l.click();}} className="p-4 bg-white/5 hover:bg-white/10 rounded-3xl text-slate-300 hover:text-white transition-all flex flex-col items-center gap-1" title="Download Image">
                    <Download size={20} />
                    <span className="text-[8px] font-black uppercase tracking-tighter">Save</span>
                   </button>
                </div>
              </div>
            </div>
          ) : !isLoading && (
            <div className="flex flex-col items-center text-center space-y-8 opacity-10"><BrainCircuit size={100} className="text-white" /><h4 className="text-3xl font-black text-white uppercase tracking-[0.4em]">Neural Core Idle</h4></div>
          )}
        </div>

        {gallery.length > 0 && (
          <div className="w-full shrink-0 pt-8 border-t border-white/5 flex flex-col gap-4 animate-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 px-2">
                <History size={16} className="text-yellow-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Generation Archive</span>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 px-2 scrollbar-hide">
              {gallery.map((img, i) => (
                <button key={i} onClick={() => onSelectFromGallery(img)} className={`shrink-0 w-20 h-20 md:w-28 md:h-28 rounded-2xl overflow-hidden border-[3px] transition-all hover:scale-105 active:scale-95 ${previewImage === img ? 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)]' : 'border-white/5 grayscale hover:grayscale-0 opacity-40 hover:opacity-100'}`}>
                  <img src={img} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {uploadSlotIdx !== null && !editingImage && (<div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-8 animate-in fade-in duration-300"><div className="w-full max-w-lg bg-[#0a0f1d] border border-white/10 rounded-[3rem] p-12 text-center space-y-8 relative shadow-2xl"><button onClick={() => setUploadSlotIdx(null)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={32} /></button><div className="w-24 h-24 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 mx-auto"><FileUp size={40} /></div><h2 className="text-3xl font-black text-white uppercase italic tracking-tight">Slot #{uploadSlotIdx+1}</h2><div className="grid grid-cols-2 gap-4"><button onClick={() => fileInputRef.current?.click()} className="p-8 bg-white/5 border border-white/5 rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10">Browse Files</button><button onClick={() => {navigator.clipboard.read().then(items => {for (const item of items) {for (const type of item.types) {if (type.startsWith('image/')) {item.getType(type).then(blob => {const reader = new FileReader(); reader.onloadend = () => openEditor(reader.result as string, uploadSlotIdx!); reader.readAsDataURL(blob);}); return;}}}});}} className="p-8 bg-white/5 border border-white/5 rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10">Paste Clip</button></div></div><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} /></div>)}
        {editingImage && (<div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in"><div className="w-full max-w-6xl h-[85vh] bg-[#05080f] border border-white/10 rounded-[4rem] flex flex-col overflow-hidden shadow-2xl"><div className="px-12 py-8 border-b border-white/5 flex items-center justify-between"><div className="flex items-center gap-4"><Scissors size={24} className="text-yellow-500" /><h3 className="text-xl font-black text-white uppercase italic tracking-tight">Refine Rig</h3></div><button onClick={() => {setEditingImage(null); setUploadSlotIdx(null);}} className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white"><X size={24} /></button></div><div className="flex-1 flex min-h-0"><div className="flex-1 bg-black/50 p-12 flex items-center justify-center overflow-hidden"><div className="relative transition-transform duration-300" style={{ transform: `rotate(${editorRotation}deg) scaleX(${editorFlipH ? -1 : 1})`, filter: `brightness(${editorBrightness}%) contrast(${editorContrast}%)` }}><img src={editingImage} className="max-w-[100%] max-h-[60vh] object-contain rounded-lg shadow-2xl" /></div><canvas ref={editorCanvasRef} className="hidden" /></div><div className="w-80 border-l border-white/5 p-10 flex flex-col gap-10 bg-slate-900/10 overflow-y-auto"><div className="space-y-6"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><RotateCw size={14} /> Flip & Rotate</label><div className="flex gap-3"><button onClick={() => setEditorRotation(prev => (prev + 90) % 360)} className="flex-1 py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black text-slate-400 hover:text-white">Rotate</button><button onClick={() => setEditorFlipH(!editorFlipH)} className="flex-1 py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black text-slate-400 hover:text-white">Flip H</button></div></div><div className="space-y-8"><div className="space-y-4"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between">Brightness <span className="text-yellow-500">{editorBrightness}%</span></label><input type="range" min="50" max="150" value={editorBrightness} onChange={(e) => setEditorBrightness(parseInt(e.target.value))} className="w-full accent-yellow-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" /></div><div className="space-y-4"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between">Contrast <span className="text-yellow-500">{editorContrast}%</span></label><input type="range" min="50" max="150" value={editorContrast} onChange={(e) => setEditorContrast(parseInt(e.target.value))} className="w-full accent-yellow-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" /></div></div><div className="mt-auto pt-10 border-t border-white/5 flex flex-col gap-4"><button onClick={finalizeEditing} className="w-full py-6 bg-yellow-500 hover:bg-yellow-400 text-[#05080f] font-black rounded-3xl flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-sm shadow-xl shadow-yellow-500/10"><Check size={20} /> Deploy Changes</button></div></div></div></div></div>)}
        
        {isFullscreen && (fullscreenImageUrl || seedPreviewUrl) && (
          <div className="fixed inset-0 z-[1100] bg-black/98 backdrop-blur-3xl flex items-center justify-center animate-in fade-in duration-300">
             <div className="absolute top-8 right-8 flex gap-3">
               <button onClick={() => openEditor((fullscreenImageUrl || seedPreviewUrl)!, 0)} className="text-white bg-white/10 hover:bg-yellow-500 hover:text-[#05080f] p-4 rounded-full transition-all flex items-center gap-2 text-xs font-black uppercase"><Edit3 size={24} /> Edit</button>
               <button onClick={() => {setIsFullscreen(false); setFullscreenImageUrl(null); setSeedPreviewUrl(null);}} className="text-white hover:bg-white/10 p-4 rounded-full transition-all"><X size={32} /></button>
             </div>
             <img src={(fullscreenImageUrl || seedPreviewUrl)!} className="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-2xl" />
          </div>
        )}

        {isPromptFullscreen && (
          <div className="fixed inset-0 z-[2000] bg-[#020408]/98 backdrop-blur-3xl flex items-center justify-center p-12 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-full max-w-5xl h-[80vh] flex flex-col relative">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4 text-white uppercase italic font-black">
                   <BrainCircuit size={32} className="text-yellow-500" />
                   <h2 className="text-2xl tracking-tighter">Expanded Narrative Weaver</h2>
                </div>
                <button 
                  onClick={() => setIsPromptFullscreen(false)} 
                  className="p-4 bg-white/5 hover:bg-red-500/20 text-slate-500 hover:text-red-500 rounded-full transition-all border border-white/5"
                >
                  <Minimize2 size={32} />
                </button>
              </div>
              <div className="flex-1 relative">
                <textarea 
                  ref={fullscreenTextareaRef}
                  autoFocus
                  value={prompt} 
                  onChange={handlePromptChange} 
                  onBlur={() => onCommitPrompt(prompt)}
                  className="w-full h-full bg-[#0a0f1d] border border-white/10 rounded-[3rem] p-12 text-2xl text-slate-100 placeholder:text-slate-800 focus:outline-none focus:border-yellow-500/50 transition-all resize-none custom-scrollbar font-medium"
                  placeholder="The scene unfolds as follows..."
                />
                {showMentions && (
                    <div className="absolute top-0 right-full mr-8 w-64 bg-[#0d1324] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden z-[9999] animate-in slide-in-from-right-4">
                       <div className="px-5 py-3 border-b border-white/5 bg-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Select Reference</div>
                       <div className="max-h-96 overflow-y-auto custom-scrollbar">
                        {/* Seeds at the top */}
                        {filteredSeeds.map(s => (<button key={s.id} onClick={() => insertMention(s.name.replace(/\s+/g, ''))} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 text-left border-b border-white/5 transition-colors"><img src={s.imageData} className="w-8 h-8 rounded object-cover border border-white/10" /><span className="text-[11px] font-black text-white uppercase tracking-widest">@{s.name.replace(/\s+/g, '')}</span></button>))}
                        {filteredImageMentions.map((tag) => (<button key={tag} onClick={() => insertMention(tag)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 text-left border-b border-white/5 transition-colors group/mention"><div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-slate-500 group-hover/mention:text-yellow-500 transition-colors"><ImageIcon size={14} /></div><span className="text-[11px] font-black text-white uppercase tracking-widest">@{tag}</span></button>))}
                       </div>
                    </div>
                  )}
              </div>
              <div className="flex justify-end gap-6 mt-8 items-center">
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-[0.4em]">Use @ for mentions • Esc to close</span>
                <button 
                  onClick={() => setIsPromptFullscreen(false)}
                  className="px-12 py-5 bg-yellow-500 text-[#05080f] font-black rounded-[2rem] uppercase tracking-widest text-sm hover:bg-yellow-400 transition-all shadow-xl shadow-yellow-500/20"
                >
                  Return to Workspace
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-sidebar { scrollbar-width: none; }
        .custom-sidebar::-webkit-scrollbar { display: none; }
        @keyframes weaving { 0%, 100% { height: 32px; opacity: 0.4; } 50% { height: 64px; opacity: 1; } }
        .animate-weaving { animation: weaving 1s ease-in-out infinite; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}} />
    </div>
  );
};

export default EditorWorkspace;