
import React, { useState, useEffect, useRef } from 'react';
import { AppMode, GenSettings, AvatarSeed } from '../types';
import { rewritePrompt } from '../services/geminiService';
import { 
  Wand2, Loader2, Image as ImageIcon, Plus, Sliders, 
  Hash, Sparkles, User, Users as UsersIcon, ChevronLeft, AtSign,
  Zap, Shield, RefreshCw, X, Download, Maximize2, Repeat, Layers, MoreVertical, Trash2, Edit3,
  MousePointer2, Copy, FileUp, Ban, BrainCircuit, RotateCw, FlipHorizontal, Sun, Contrast, Check, Scissors, Camera
} from 'lucide-react';

interface Props {
  mode: AppMode;
  settings: GenSettings;
  negativePrompt: string;
  neuralMemory: string;
  onUpdateSettings: (s: GenSettings) => void;
  onUpdateNegativePrompt: (np: string) => void;
  onGenerate: (prompt: string, images: string[], determinedRatio?: string) => void;
  isLoading: boolean;
  previewImage: string | null;
  seeds: AvatarSeed[];
  onBackToHome: () => void;
  onRemoveSeed: (id: string) => void;
  onRenameSeed: (id: string, newName: string) => void;
}

const EditorWorkspace: React.FC<Props> = ({ 
  mode, 
  settings, 
  negativePrompt,
  neuralMemory,
  onUpdateSettings, 
  onUpdateNegativePrompt,
  onGenerate, 
  isLoading, 
  previewImage,
  seeds,
  onBackToHome,
  onRemoveSeed,
  onRenameSeed
}) => {
  const [prompt, setPrompt] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>(new Array(5).fill(''));
  const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
  const [seedPreviewUrl, setSeedPreviewUrl] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [uploadSlotIdx, setUploadSlotIdx] = useState<number | null>(null);
  const [sourceSlotsCount, setSourceSlotsCount] = useState<number>(mode === AppMode.SINGLE_PLAY ? 1 : 5);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [progress, setProgress] = useState(0);

  // Image Editor State
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editorRotation, setEditorRotation] = useState(0);
  const [editorFlipH, setEditorFlipH] = useState(false);
  const [editorBrightness, setEditorBrightness] = useState(100);
  const [editorContrast, setEditorContrast] = useState(100);
  
  const progressTimerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (seeds.length > 0 && !selectedSeedId) {
      setSelectedSeedId(seeds[0].id);
    }
  }, [seeds, selectedSeedId]);

  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      progressTimerRef.current = window.setInterval(() => {
        setProgress(prev => {
          if (prev < 94) return prev + Math.random() * 1.8;
          if (prev < 99.5) return prev + 0.02;
          return prev;
        });
      }, 150);
    } else {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (progress > 0) setProgress(100);
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
  };

  const processFile = (file: File, idx: number) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        openEditor(reader.result as string, idx);
        setUploadSlotIdx(null);
      };
      reader.readAsDataURL(file);
    }
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
      const newImgs = [...uploadedImages];
      newImgs[uploadSlotIdx] = finalDataUrl;
      setUploadedImages(newImgs);
      setEditingImage(null);
      setUploadSlotIdx(null);
    };
    img.src = editingImage;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0] && uploadSlotIdx !== null) {
      processFile(e.target.files[0], uploadSlotIdx);
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    setPrompt(value);
    
    // Surgical Mention Detection
    const textBeforeCursor = value.substring(0, position);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    
    if (lastAt !== -1) {
      const segment = textBeforeCursor.substring(lastAt);
      if (!segment.includes(' ')) {
        setShowMentions(true);
        setMentionFilter(segment.substring(1).toLowerCase());
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (mention: string) => {
    if (!textareaRef.current) return;
    const position = textareaRef.current.selectionStart;
    const textBefore = prompt.substring(0, position);
    const lastAt = textBefore.lastIndexOf('@');
    
    if (lastAt !== -1) {
      const newPrompt = prompt.substring(0, lastAt) + '@' + mention + ' ' + prompt.substring(position);
      setPrompt(newPrompt);
      setShowMentions(false);
      // Wait for re-render then focus and place cursor at end of mention
      setTimeout(() => {
        textareaRef.current?.focus();
        const newCursorPos = lastAt + mention.length + 2;
        textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  const handleSurpriseMe = async () => {
    if (!prompt.trim() || isRewriting) return;
    setIsRewriting(true);
    try {
      const betterPrompt = await rewritePrompt(prompt, neuralMemory);
      setPrompt(betterPrompt);
    } catch (e) {
    } finally {
      setIsRewriting(false);
    }
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
    let finalImages = uploadedImages.filter(Boolean);
    let processedPrompt = prompt;

    // Apply Perspective settings into instructions context
    seeds.forEach(s => {
      const mentionTag = `@${s.name.replace(/\s+/g, '')}`;
      if (processedPrompt.includes(mentionTag)) {
        processedPrompt = processedPrompt.replace(new RegExp(mentionTag, 'g'), `[IDENTITY_LOCK: ${s.id}]`);
        if (!finalImages.includes(s.imageData)) finalImages.push(s.imageData);
      }
    });

    const currentSeed = seeds.find(s => s.id === selectedSeedId);
    if (currentSeed && !finalImages.includes(currentSeed.imageData)) {
      finalImages.unshift(currentSeed.imageData);
    }

    let finalRatio: string = settings.aspectRatio;
    if (finalRatio === "Original" && uploadedImages[0]) {
      finalRatio = await detectAspectRatio(uploadedImages[0]);
    }

    onGenerate(processedPrompt, finalImages, finalRatio);
  };

  const isGenerateDisabled = isLoading || (uploadedImages.filter(Boolean).length === 0 && !selectedSeedId);

  return (
    <div className="flex h-full w-full overflow-hidden font-sans bg-[#020408]">
      {/* Sidebar */}
      <aside className="w-[420px] bg-[#05080f] border-r border-white/5 flex flex-col h-full z-10 shadow-2xl relative shrink-0">
        <div className="absolute inset-0 overflow-y-auto custom-sidebar overflow-x-hidden">
          <div className="p-8 space-y-12 pb-60 flex flex-col min-h-fit">
            
            <div className="flex items-center justify-between shrink-0">
              <button 
                onClick={onBackToHome}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-[11px] font-black uppercase tracking-widest border border-white/5"
              >
                <ChevronLeft size={16} /> Back
              </button>
              <div className="text-right">
                <div className="text-[10px] font-black tracking-[0.3em] text-yellow-500 uppercase mb-0.5">Neural Engine</div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight italic">
                  {mode.replace('_', ' ')}
                </h3>
              </div>
            </div>

            {/* 1. Identity Seeds */}
            <div className="space-y-6 shrink-0 relative">
              <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]">
                <Hash size={14} className="text-yellow-500" /> Identity Seeds
              </label>
              <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x px-2 overflow-y-visible">
                {seeds.map(s => (
                  <div key={s.id} className="relative shrink-0 snap-center group/seed-card overflow-visible">
                    <div className="relative">
                      <button 
                        onClick={() => setSelectedSeedId(s.id === selectedSeedId ? null : s.id)}
                        className={`relative w-24 h-24 rounded-2xl overflow-hidden border-[4px] transition-all transform ${
                          selectedSeedId === s.id 
                          ? 'border-yellow-500 scale-105 shadow-[0_0_30px_rgba(234,179,8,0.4)]' 
                          : 'border-[#1e293b] opacity-60 hover:opacity-100 hover:border-yellow-500/50'
                        }`}
                      >
                        <img src={s.imageData} className="w-full h-full object-cover" />
                      </button>

                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-[#05080f] text-[10px] font-black px-3 py-1 rounded-full border-2 border-[#05080f] shadow-lg pointer-events-none">
                        {s.id.split('_').pop()}
                      </div>

                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === s.id ? null : s.id); }}
                        className="absolute bottom-1 right-1 bg-[#0d1324] text-slate-400 hover:text-white p-1.5 rounded-full border border-white/10 shadow-xl opacity-0 group-hover/seed-card:opacity-100 transition-opacity z-[60]"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {activeMenuId === s.id && (
                        <div className="absolute top-1/2 left-full ml-4 -translate-y-1/2 w-44 bg-[#111827] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[999] animate-in fade-in slide-in-from-left-4">
                           <button onClick={() => { setSeedPreviewUrl(s.imageData); setIsFullscreen(true); setActiveMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-slate-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest border-b border-white/5"><Maximize2 size={14} /> View Master</button>
                           <button onClick={() => { onRemoveSeed(s.id); setActiveMenuId(null); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-500 transition-colors text-[10px] font-black uppercase tracking-widest"><Trash2 size={14} /> Remove</button>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center truncate w-24">
                      {s.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Source Photometry */}
            <div className="space-y-4 shrink-0">
               <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]">
                    <ImageIcon size={14} className="text-yellow-500" /> Source Photometry
                  </label>
                  <div className="flex bg-[#0a0f1d] p-1 rounded-xl border border-white/5">
                    <button onClick={() => { setSourceSlotsCount(1); onUpdateSettings({...settings, aspectRatio: "Original"}); }} className={`px-4 py-1 rounded-lg text-[9px] font-black transition-all ${sourceSlotsCount === 1 ? 'bg-yellow-500 text-[#05080f]' : 'text-slate-500'}`}>SOLO</button>
                    <button onClick={() => setSourceSlotsCount(5)} className={`px-4 py-1 rounded-lg text-[9px] font-black transition-all ${sourceSlotsCount > 1 ? 'bg-yellow-500 text-[#05080f]' : 'text-slate-500'}`}>COMBO</button>
                  </div>
               </div>
               <div className={`grid ${sourceSlotsCount === 1 ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
                  {[...Array(sourceSlotsCount)].map((_, i) => (
                    <button 
                      key={i}
                      onClick={() => setUploadSlotIdx(i)}
                      className={`aspect-square w-full bg-slate-800/10 border border-white/5 rounded-[1.5rem] flex items-center justify-center hover:border-yellow-500/30 transition-all overflow-hidden relative group/source ${sourceSlotsCount === 1 ? 'max-w-[200px] mx-auto rounded-[3rem]' : ''}`}
                    >
                      {uploadedImages[i] ? (
                        <>
                          <img src={uploadedImages[i]} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/source:opacity-100 flex items-center justify-center transition-opacity"><RefreshCw size={sourceSlotsCount === 1 ? 32 : 20} className="text-white" /></div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1 opacity-20 group-hover/source:opacity-100 transition-opacity">
                          <Plus className="text-slate-500" size={sourceSlotsCount === 1 ? 32 : 18} />
                          <span className="text-[7px] font-black tracking-widest uppercase">Slot {i+1}</span>
                        </div>
                      )}
                    </button>
                  ))}
               </div>
            </div>

            {/* 3. Neural Logic */}
            <div className="space-y-6 shrink-0 relative">
              <div className="space-y-4">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                  Neural Narrative
                  <span className="text-[9px] text-slate-600 font-bold uppercase flex items-center gap-1 opacity-50"><AtSign size={12} /> Tags Enabled</span>
                </label>
                <div className="relative group/prompt overflow-hidden rounded-[2.5rem]">
                   {/* Digital Weaving/Rewrite Animation */}
                  {isRewriting && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center space-y-3 pointer-events-none animate-in fade-in duration-500">
                      <div className="absolute inset-0 bg-[#0a0f1d]/80 backdrop-blur-md" />
                      <div className="relative">
                        <div className="flex gap-2">
                           {[1,2,3,4].map(i => <div key={i} className="w-2 h-8 bg-yellow-500/40 rounded-full animate-weaving" style={{ animationDelay: `${i*0.1}s` }} />)}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <BrainCircuit size={32} className="text-yellow-500 animate-pulse" />
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.4em] relative z-30">Synthesizing Logic</span>
                    </div>
                  )}

                  <textarea 
                    ref={textareaRef}
                    value={prompt}
                    onChange={handlePromptChange}
                    placeholder="Describe your vision... @image1 @PariMishra"
                    className={`w-full h-40 bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-6 text-sm text-slate-200 placeholder:text-slate-800 focus:outline-none focus:border-yellow-500/50 transition-all resize-none custom-scrollbar ${isRewriting ? 'text-transparent' : 'text-slate-200'}`}
                  />
                  {showMentions && (
                    <div className="absolute bottom-full left-0 w-full mb-4 bg-[#0d1324] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden z-[250] animate-in slide-in-from-bottom-3">
                       <div className="px-5 py-3 border-b border-white/5 bg-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Mention Catalog</div>
                       <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {[...Array(sourceSlotsCount)].map((_, i) => (
                          <button key={i} onClick={() => insertMention(`image${i+1}`)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 text-left border-b border-white/5 transition-colors">
                            <span className="text-[11px] font-black text-white uppercase tracking-widest">@image{i+1}</span>
                          </button>
                        ))}
                        {seeds.filter(s => s.name.toLowerCase().includes(mentionFilter)).map(s => (
                          <button key={s.id} onClick={() => insertMention(s.name.replace(/\s+/g, ''))} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 text-left border-b border-white/5 transition-colors">
                            <img src={s.imageData} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                            <span className="text-[11px] font-black text-white uppercase tracking-widest">@{s.name.replace(/\s+/g, '')}</span>
                          </button>
                        ))}
                       </div>
                    </div>
                  )}
                </div>

                {neuralMemory && (
                  <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-start gap-4">
                     <BrainCircuit size={18} className="text-blue-500 shrink-0 mt-1" />
                     <div className="space-y-1">
                       <div className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">Contextual Recall</div>
                       <p className="text-[10px] text-slate-400 font-medium italic leading-relaxed">"{neuralMemory}"</p>
                     </div>
                  </div>
                )}
                
                <div className="flex justify-end">
                  <button onClick={handleSurpriseMe} disabled={isRewriting || !prompt.trim()} className="flex items-center gap-3 px-8 py-4 bg-[#0a0f1d] hover:bg-yellow-500/10 text-slate-500 hover:text-yellow-500 rounded-3xl border border-white/10 hover:border-yellow-500/30 transition-all group">
                    <Zap size={18} className="group-hover:fill-yellow-500 transition-all" />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em]">Neural Evolve</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Perspective Section */}
            <div className="space-y-6 pt-8 border-t border-white/5 shrink-0">
               <div className="flex items-center gap-3">
                 <Camera size={18} className="text-yellow-500" />
                 <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Perspectives</span>
               </div>
               <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Camera Angle</label>
                    <select 
                      value={settings.cameraAngle}
                      onChange={(e) => onUpdateSettings({...settings, cameraAngle: e.target.value})}
                      className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-300 focus:outline-none focus:border-yellow-500/50 appearance-none"
                    >
                      <option value="Default">Auto/Default</option>
                      <option value="Extreme close-up wide-angle">Extreme Close-up Wide Angle</option>
                      <option value="Cinematic Wide Angle">Cinematic Wide Angle</option>
                      <option value="Cowboy Shot">Cowboy Shot (Mid-Thigh Up)</option>
                      <option value="Heroic low angle">Heroic Low Angle</option>
                      <option value="Bird's eye view">Bird's Eye / Top Down</option>
                      <option value="Dutch angle">Dutch Angle (Tilted)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Pose Library</label>
                    <select 
                      value={settings.pose}
                      onChange={(e) => onUpdateSettings({...settings, pose: e.target.value})}
                      className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-300 focus:outline-none focus:border-yellow-500/50 appearance-none"
                    >
                      <option value="Default">Optional/Candid</option>
                      <option value="High fashion editorial">High Fashion Editorial</option>
                      <option value="Relaxed sitting">Relaxed Candid Sitting</option>
                      <option value="Couple embrace">Romantic Embrace (Couple)</option>
                      <option value="Symmetrical power stance">Power Stance</option>
                      <option value="Dynamic action pose">Dynamic Action / Movement</option>
                    </select>
                  </div>
               </div>
            </div>

            {/* 5. Engine Parameters */}
            <div className="space-y-10 pt-8 border-t border-white/5 shrink-0">
              <div className="flex items-center gap-3">
                <Sliders size={18} className="text-yellow-500" />
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Synthesis Logic</span>
              </div>
              <SettingSlider label="Creativity" value={settings.temperature} min={0} max={2} step={0.1} icon={<Zap size={14} />} onChange={(v: number) => onUpdateSettings({ ...settings, temperature: v })} />
              <SettingSlider label="Biometric Sync" value={settings.faceFidelity} min={0} max={1} step={0.05} icon={<Shield size={14} />} onChange={(v: number) => onUpdateSettings({ ...settings, faceFidelity: v })} />
              <div className="space-y-4">
                 <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Frame Format</label>
                 <div className="grid grid-cols-2 gap-3">
                   {["1:1", "16:9", "9:16", "Original"].map(ratio => (
                     <button key={ratio} onClick={() => onUpdateSettings({...settings, aspectRatio: ratio as any})} className={`py-3 rounded-2xl text-[9px] font-black border transition-all ${settings.aspectRatio === ratio ? 'bg-yellow-500 text-[#05080f] border-yellow-500 shadow-lg' : 'bg-[#0a0f1d] text-slate-400 border-white/5'}`}>{ratio}</button>
                   ))}
                 </div>
              </div>
            </div>

            {/* Synthesis Action */}
            <div className="pt-10 pb-40 shrink-0">
              <button 
                disabled={isGenerateDisabled}
                onClick={handleMagicClick}
                className={`w-full py-8 font-black rounded-[3rem] shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.97] group relative overflow-hidden ${
                  isGenerateDisabled ? 'bg-slate-800 text-slate-600' : 'bg-yellow-500 hover:bg-yellow-400 text-[#05080f]'
                }`}
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <><Wand2 size={28} /> <span className="uppercase text-lg tracking-[0.1em]">Synthesize Reality</span></>}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Preview Area */}
      <main className="flex-1 relative flex flex-col items-center justify-center p-12 overflow-hidden bg-[#020408]">
        {isLoading && (
          <div className="absolute top-0 left-0 w-full h-1.5 z-[60] bg-[#05080f] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 shadow-[0_0_20px_rgba(234,179,8,1)] transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}

        {previewImage ? (
          <div className="relative flex flex-col items-center animate-in fade-in zoom-in duration-1000 max-w-full max-h-full group">
            <div className="relative rounded-[4rem] overflow-hidden shadow-[0_60px_120px_rgba(0,0,0,1)] border border-white/5 transition-transform hover:scale-[1.01] duration-700">
              <img src={previewImage} className="max-h-[80vh] w-auto object-contain block" />
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 p-2 bg-slate-900/80 backdrop-blur-2xl rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-4 group-hover:translate-y-0">
                 <button onClick={() => {setFullscreenImageUrl(previewImage); setIsFullscreen(true);}} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-300"><Maximize2 size={20} /></button>
                 <button onClick={() => {const l=document.createElement('a'); l.href=previewImage; l.download='banana-gen.png'; l.click();}} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-300"><Download size={20} /></button>
              </div>
            </div>
          </div>
        ) : !isLoading && (
          <div className="flex flex-col items-center text-center space-y-8 opacity-10">
            <BrainCircuit size={100} className="text-white" />
            <h4 className="text-3xl font-black text-white uppercase tracking-[0.4em]">Neural Core Idle</h4>
          </div>
        )}

        {/* Modal Overlays (Upload Selection) */}
        {uploadSlotIdx !== null && (
          <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-8 animate-in fade-in duration-300">
             <div className="w-full max-w-lg bg-[#0a0f1d] border border-white/10 rounded-[3rem] p-12 text-center space-y-8 shadow-2xl relative">
                <button onClick={() => setUploadSlotIdx(null)} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"><X size={32} /></button>
                <div className="w-24 h-24 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 mx-auto"><FileUp size={40} /></div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tight italic">Source Component #{uploadSlotIdx+1}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => fileInputRef.current?.click()} className="p-8 bg-white/5 border border-white/5 rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Browse Files</button>
                  <button onClick={() => {
                    navigator.clipboard.read().then(items => {
                      for (const item of items) {
                        for (const type of item.types) {
                          if (type.startsWith('image/')) {
                            item.getType(type).then(blob => {
                              const reader = new FileReader();
                              reader.onloadend = () => openEditor(reader.result as string, uploadSlotIdx);
                              reader.readAsDataURL(blob);
                            });
                            return;
                          }
                        }
                      }
                    });
                  }} className="p-8 bg-white/5 border border-white/5 rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Paste Image</button>
                </div>
             </div>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
          </div>
        )}

        {/* IMAGE EDITOR WINDOW */}
        {editingImage && (
          <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="w-full max-w-6xl h-[85vh] bg-[#05080f] border border-white/10 rounded-[4rem] flex flex-col overflow-hidden shadow-2xl">
              <div className="px-12 py-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center"><Scissors size={20} className="text-[#05080f]" /></div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Refine Image Component</h3>
                </div>
                <button onClick={() => setEditingImage(null)} className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all"><X size={24} /></button>
              </div>
              <div className="flex-1 flex min-h-0">
                <div className="flex-1 bg-black/50 p-12 flex items-center justify-center overflow-hidden">
                  <div className="relative transition-transform duration-300" style={{ transform: `rotate(${editorRotation}deg) scaleX(${editorFlipH ? -1 : 1})`, filter: `brightness(${editorBrightness}%) contrast(${editorContrast}%)` }}>
                    <img src={editingImage} className="max-w-[100%] max-h-[60vh] object-contain rounded-lg shadow-2xl" />
                  </div>
                  <canvas ref={editorCanvasRef} className="hidden" />
                </div>
                <div className="w-80 border-l border-white/5 p-10 flex flex-col gap-10 bg-slate-900/10 overflow-y-auto">
                  <div className="space-y-6">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><RotateCw size={14} /> Flip & Rotate</label>
                    <div className="flex gap-3">
                      <button onClick={() => setEditorRotation(prev => (prev + 90) % 360)} className="flex-1 py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black text-slate-400 hover:text-white transition-all">Rotate</button>
                      <button onClick={() => setEditorFlipH(!editorFlipH)} className="flex-1 py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black text-slate-400 hover:text-white transition-all">Flip H</button>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between">Brightness <span className="text-yellow-500">{editorBrightness}%</span></label>
                       <input type="range" min="50" max="150" value={editorBrightness} onChange={(e) => setEditorBrightness(parseInt(e.target.value))} className="w-full accent-yellow-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                    </div>
                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between">Contrast <span className="text-yellow-500">{editorContrast}%</span></label>
                       <input type="range" min="50" max="150" value={editorContrast} onChange={(e) => setEditorContrast(parseInt(e.target.value))} className="w-full accent-yellow-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                    </div>
                  </div>
                  <div className="mt-auto pt-10 border-t border-white/5 flex flex-col gap-4">
                    <button onClick={finalizeEditing} className="w-full py-6 bg-yellow-500 hover:bg-yellow-400 text-[#05080f] font-black rounded-3xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-yellow-500/10 uppercase tracking-widest text-sm"><Check size={20} /> Deploy Changes</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isFullscreen && (fullscreenImageUrl || seedPreviewUrl) && (
          <div className="fixed inset-0 z-[1100] bg-black/98 backdrop-blur-3xl flex items-center justify-center animate-in fade-in duration-300">
             <button onClick={() => {setIsFullscreen(false); setFullscreenImageUrl(null); setSeedPreviewUrl(null);}} className="absolute top-8 right-8 text-white hover:bg-white/10 p-4 rounded-full transition-all"><X size={40} /></button>
             <img src={(fullscreenImageUrl || seedPreviewUrl)!} className="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-2xl" />
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-sidebar { scrollbar-width: none; }
        .custom-sidebar::-webkit-scrollbar { display: none; }
        @keyframes weaving {
          0%, 100% { height: 32px; opacity: 0.4; }
          50% { height: 64px; opacity: 1; }
        }
        .animate-weaving {
          animation: weaving 1s ease-in-out infinite;
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
};

const SettingSlider = ({ label, value, min, max, step, onChange, icon }: any) => (
  <div className="space-y-5">
    <div className="flex justify-between items-center">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">{icon} {label}</span>
      <span className="text-[11px] font-black text-yellow-500 tabular-nums bg-yellow-500/10 px-3 py-1.5 rounded-xl border border-yellow-500/20">{value}</span>
    </div>
    <div className="relative flex items-center">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500 focus:outline-none" />
      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-blue-500 rounded-full pointer-events-none" style={{ width: `${(value - min) / (max - min) * 100}%` }} />
    </div>
  </div>
);

export default EditorWorkspace;
