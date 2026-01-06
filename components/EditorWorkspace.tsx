import React, { useState, useEffect, useRef } from 'react';
import { AppMode, GenSettings, AvatarSeed, ValidAspectRatio, ValidImageSize, GalleryItem } from '../types.ts';
import { 
  Wand2, Loader2, Image as ImageIcon, Plus, 
  Sparkles, ChevronLeft, AtSign, Maximize2, 
  MoreVertical, Trash2, Scissors, Camera, BrainCircuit, 
  RotateCw, Download, X, Thermometer, ShieldCheck, 
  Layers, Layout, Monitor, Undo2, Redo2, History, Target,
  RefreshCcw, Edit3, Move, Crop, Fingerprint, User, Palette, 
  Sun, Contrast, Cpu, Film, Dna, Database, UserCheck, Paintbrush,
  Files, Gem, Package, Youtube
} from 'lucide-react';
import SeedPromptModal from './SeedPromptModal.tsx';

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
  gallery: GalleryItem[];
  seeds: AvatarSeed[];
  onBackToHome: () => void;
  onRemoveSeed: (id: string) => void;
  onRenameSeed: (id: string, newName: string) => void;
  autoFillImage?: string | null;
  onAutoFillConsumed?: () => void;
  onAddSeed?: (data: string, name: string, tags: string[]) => void;
}

const EditorWorkspace: React.FC<Props> = ({ 
  mode, settings, negativePrompt, prompt, canUndo, canRedo, onUndo, onRedo,
  onUpdatePrompt, onCommitPrompt, neuralMemory, onUpdateSettings, 
  onUpdateNegativePrompt, onGenerate, isLoading, previewImage, 
  onSelectFromGallery, gallery, seeds, onBackToHome, onRemoveSeed, onRenameSeed,
  autoFillImage, onAutoFillConsumed, onAddSeed
}) => {
  const [uploadedImages, setUploadedImages] = useState<string[]>(new Array(24).fill(''));
  const [isSoloMode, setIsSoloMode] = useState(false);
  const [showFullGallery, setShowFullGallery] = useState(false);
  const [isPromptFullscreen, setIsPromptFullscreen] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [uploadSlotIdx, setUploadSlotIdx] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editorRotation, setEditorRotation] = useState(0);
  const [editorFlipH, setEditorFlipH] = useState(false);
  const [editorBrightness, setEditorBrightness] = useState(100);
  const [editorExposure, setEditorExposure] = useState(100);
  const [editorSharpness, setEditorSharpness] = useState(0);
  
  const [cropT, setCropT] = useState(0);
  const [cropB, setCropB] = useState(0);
  const [cropL, setCropL] = useState(0);
  const [cropR, setCropR] = useState(0);

  const [showSeedCreationModal, setShowSeedCreationModal] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');

  const [batchTarget, setBatchTarget] = useState<{ start: number, limit: number } | null>(null);

  const progressTimerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fullscreenTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editorCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchAssetsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoading) {
      setProgress(5);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      progressTimerRef.current = window.setInterval(() => {
        setProgress(prev => (prev < 98 ? prev + Math.random() * 1.5 : prev));
      }, 120);
    } else {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (progress > 0) {
        setProgress(100);
        setTimeout(() => setProgress(0), 600);
      }
    }
  }, [isLoading]);

  useEffect(() => {
    if (autoFillImage && onAutoFillConsumed) {
      setUploadedImages(prev => {
        const next = [...prev];
        next[0] = autoFillImage; 
        return next;
      });
      onAutoFillConsumed();
    }
  }, [autoFillImage, onAutoFillConsumed]);

  const handleSeedModalConfirm = (data: string, name: string, tags: string[]) => {
    if (onAddSeed) onAddSeed(data, name, tags);
    if (uploadSlotIdx !== null) {
      setUploadedImages(prev => {
        const next = [...prev];
        next[uploadSlotIdx] = data;
        return next;
      });
    }
    setShowSeedCreationModal(false);
    setUploadSlotIdx(null);
  };

  const openEditor = (dataUrl: string, idx: number) => {
    setEditingImage(dataUrl);
    setUploadSlotIdx(idx);
  };

  const finalizeEditing = (modeAction: 'save' | 'reuse' = 'save') => {
    if (!editorCanvasRef.current || !editingImage || uploadSlotIdx === null) return;
    const canvas = editorCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      const sourceW = img.width * (1 - (cropL + cropR) / 100);
      const sourceH = img.height * (1 - (cropT + cropB) / 100);
      canvas.width = sourceW;
      canvas.height = sourceH;
      ctx!.save();
      ctx!.filter = `brightness(${editorBrightness}%) contrast(${editorExposure}%) grayscale(${editorSharpness < 0 ? Math.abs(editorSharpness) : 0}%)`;
      ctx!.translate(sourceW / 2, sourceH / 2);
      ctx!.rotate((editorRotation * Math.PI) / 180);
      if (editorFlipH) ctx!.scale(-1, 1);
      ctx!.drawImage(img, (cropL/100)*img.width, (cropT/100)*img.height, sourceW, sourceH, -sourceW/2, -sourceH/2, sourceW, sourceH);
      ctx!.restore();
      const dataUrl = canvas.toDataURL('image/jpeg', 0.98);
      if (modeAction === 'reuse') {
        reuseImage(dataUrl);
      } else {
        setUploadedImages(prev => {
          const next = [...prev];
          next[uploadSlotIdx!] = dataUrl;
          return next;
        });
      }
      setEditingImage(null);
    };
    img.src = editingImage;
  };

  const reuseImage = (img: string) => {
    let startIdx = 0;
    if (mode === AppMode.GROUP_PHOTO) {
      startIdx = isSoloMode ? 4 : 3;
    }
    setUploadedImages(prev => {
      const next = [...prev];
      const emptyIdx = next.slice(startIdx, 20).findIndex(item => !item);
      next[emptyIdx !== -1 ? startIdx + emptyIdx : startIdx] = img;
      return next;
    });
  };

  const handleMagicClick = async () => {
    if (!prompt.trim() && uploadedImages.filter(Boolean).length === 0) return;
    let finalImages: string[] = [];
    let processedPrompt = prompt;
    const seenImages = new Set<string>();
    
    if (mode === AppMode.GROUP_PHOTO) {
      seeds.forEach(s => {
        const tag = `@${s.name.replace(/\s+/g, '')}`;
        if (processedPrompt.includes(tag)) {
          processedPrompt = processedPrompt.replace(new RegExp(tag, 'g'), `[SEED_${s.id}]`);
          if (!seenImages.has(s.imageData)) { finalImages.push(s.imageData); seenImages.add(s.imageData); }
        }
      });
    }

    uploadedImages.forEach((img, i) => {
      if (!img) return;
      const tag = `@image${i}`;
      if (processedPrompt.includes(tag)) {
        processedPrompt = processedPrompt.replace(new RegExp(tag, 'g'), `[REFERENCE_IMAGE_${i}]`);
        if (!seenImages.has(img)) { finalImages.push(img); seenImages.add(img); }
      }
    });

    if (finalImages.length === 0) {
      uploadedImages.forEach(img => { if (img && !seenImages.has(img)) { finalImages.push(img); seenImages.add(img); } });
    }

    onGenerate(processedPrompt, finalImages);
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const pos = e.target.selectionStart;
    onUpdatePrompt(value);
    const lastAt = value.substring(0, pos).lastIndexOf('@');
    if (lastAt !== -1 && !value.substring(lastAt, pos).includes(' ')) {
      setShowMentions(true);
      setMentionFilter(value.substring(lastAt + 1, pos).toLowerCase());
    } else setShowMentions(false);
  };

  const insertMention = (mention: string) => {
    const ref = isPromptFullscreen ? fullscreenTextareaRef : textareaRef;
    const pos = ref.current!.selectionStart;
    const lastAt = prompt.substring(0, pos).lastIndexOf('@');
    const next = prompt.substring(0, lastAt) + '@' + mention + ' ' + prompt.substring(pos);
    onUpdatePrompt(next);
    onCommitPrompt(next);
    setShowMentions(false);
    setTimeout(() => ref.current?.focus(), 0);
  };

  const getUniqueMentions = () => {
    const seenData = new Set<string>();
    const result: any[] = [];
    
    if (mode === AppMode.GROUP_PHOTO) {
      seeds.forEach(s => {
        if (!seenData.has(s.imageData)) {
          seenData.add(s.imageData);
          result.push({ tag: s.name.replace(/\s+/g, ''), data: s.imageData, label: 'Identity' });
        }
      });
    }
    
    uploadedImages.forEach((data, i) => {
      if (data && !seenData.has(data)) {
        let label = 'Asset';
        if (mode === AppMode.PORTRAIT_GENERATOR) {
          label = i < 9 ? 'Face Ref' : (i < 15 ? 'Style Ref' : 'Asset');
        } else if (mode === AppMode.ACCESSORIES_GENERATOR) {
          label = i < 3 ? 'Ref Asset' : 'Asset';
        } else if (mode === AppMode.THUMBNAIL_CREATOR) {
          label = 'Visual Cue';
        } else {
          label = i < 3 ? 'Identity' : 'Asset';
        }
        result.push({ tag: `image${i}`, data, label });
      }
    });
    
    return result.filter(m => m.tag.toLowerCase().includes(mentionFilter));
  };

  const MentionList: React.FC<{ isFullscreen?: boolean }> = ({ isFullscreen = false }) => (
    <div className={`absolute ${isFullscreen ? 'left-[calc(100%+1rem)] top-0 w-64' : 'bottom-full left-0 mb-4 w-64'} bg-[#0d1324] border border-white/10 rounded-2xl shadow-2xl z-[500] overflow-hidden flex flex-col animate-in slide-in-from-bottom-2`}>
      <div className="px-4 py-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Neural Selector</span>
        <AtSign size={10} className="text-yellow-500" />
      </div>
      <div className="max-h-60 overflow-y-auto custom-scrollbar">
        {getUniqueMentions().map((m, i) => (
          <button 
            key={i} 
            onMouseDown={(e) => { e.preventDefault(); insertMention(m.tag); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-yellow-500/10 transition-colors border-b border-white/5 last:border-0 group"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0">
              <img src={m.data} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col items-start truncate">
              <span className="text-xs font-bold text-slate-200 group-hover:text-yellow-500 transition-colors">@{m.tag}</span>
              <span className="text-[8px] font-black uppercase tracking-tighter text-slate-500">{m.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const ImageSlot: React.FC<{ idx: number, label?: string, icon?: any }> = ({ idx, label, icon: Icon }) => {
    const data = uploadedImages[idx];
    return (
      <div className="relative aspect-square group">
        <button 
          onClick={() => data ? openEditor(data, idx) : handleUploadTrigger(idx)} 
          className={`w-full h-full bg-slate-800/20 border border-white/5 rounded-[1.5rem] overflow-hidden hover:border-yellow-500/30 transition-all flex flex-col items-center justify-center ${data ? 'shadow-lg border-white/20' : ''}`}
        >
          {data ? <img src={data} className="w-full h-full object-cover" /> : (
            <div className="flex flex-col items-center gap-2 opacity-20">
              {Icon ? <Icon size={18} /> : (idx < 3 ? <Fingerprint size={18} /> : <Layers size={18} />)}
              {label && <span className="text-[7px] font-black uppercase tracking-[0.2em]">{label}</span>}
            </div>
          )}
        </button>
        {data && (
          <button onClick={() => setUploadedImages(prev => { const n = [...prev]; n[idx] = ''; return n; })} className="absolute -top-1 -right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"><X size={10} /></button>
        )}
      </div>
    );
  };

  const handleUploadTrigger = (idx: number) => {
    setUploadSlotIdx(idx);
    setBatchTarget(null);
    if (mode === AppMode.GROUP_PHOTO && idx < 3) {
      setShowSeedCreationModal(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleBatchTrigger = (start: number, limit: number) => {
    setBatchTarget({ start, limit });
    setUploadSlotIdx(null);
    batchAssetsInputRef.current?.click();
  };

  const handleBatchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !batchTarget) return;
    const filesArray = (Array.from(files) as File[]).slice(0, batchTarget.limit);
    let processedCount = 0;
    const newImages = [...uploadedImages];
    filesArray.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const targetIdx = batchTarget.start + i;
        if (targetIdx < newImages.length) newImages[targetIdx] = dataUrl;
        processedCount++;
        if (processedCount === filesArray.length) {
          setUploadedImages(newImages);
          setBatchTarget(null);
        }
      };
      reader.readAsDataURL(file as Blob);
    });
    e.target.value = '';
  };

  return (
    <div className="absolute inset-0 flex font-sans bg-[#020408] overflow-hidden">
      <aside className="w-[420px] bg-[#05080f] border-r border-white/5 flex flex-col h-full shrink-0 z-20 shadow-2xl overflow-y-auto custom-scrollbar">
        <div className="p-8 space-y-10">
            <div className="flex items-center justify-between">
              <button onClick={onBackToHome} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-slate-400 text-[11px] font-black border border-white/5 hover:text-white transition-all"><ChevronLeft size={16} /> Back</button>
              {mode === AppMode.GROUP_PHOTO && (
                <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/5">
                  <button onClick={() => setIsSoloMode(false)} className={`px-2 py-1 text-[8px] font-black rounded-lg transition-all ${!isSoloMode ? 'bg-yellow-500 text-[#05080f]' : 'text-slate-500'}`}>GROUP</button>
                  <button onClick={() => setIsSoloMode(true)} className={`px-2 py-1 text-[8px] font-black rounded-lg transition-all ${isSoloMode ? 'bg-yellow-500 text-[#05080f]' : 'text-slate-500'}`}>SOLO</button>
                </div>
              )}
            </div>

            {mode === AppMode.PORTRAIT_GENERATOR ? (
              <div className="space-y-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><UserCheck size={14} className="text-yellow-500" /> Face References</label>
                    <button onClick={() => handleBatchTrigger(0, 9)} className="flex items-center gap-1 text-[8px] font-black text-yellow-500 uppercase bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20 hover:bg-yellow-500/20 transition-all"><Files size={10} /> Batch</button>
                  </div>
                  <div className="grid grid-cols-3 gap-4">{[0,1,2,3,4,5,6,7,8].map(i => <ImageSlot key={i} idx={i} icon={Fingerprint} />)}</div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><Paintbrush size={14} className="text-emerald-500" /> Style References</label>
                    <button onClick={() => handleBatchTrigger(9, 6)} className="flex items-center gap-1 text-[8px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"><Files size={10} /> Batch</button>
                  </div>
                  <div className="grid grid-cols-3 gap-4">{[9,10,11,12,13,14].map(i => <ImageSlot key={i} idx={i} icon={Palette} />)}</div>
                </div>
              </div>
            ) : mode === AppMode.THUMBNAIL_CREATOR ? (
              <div className="space-y-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><Layout size={14} className="text-yellow-500" /> Thumbnail Inspirations</label>
                    <button onClick={() => handleBatchTrigger(0, 12)} className="flex items-center gap-1 text-[8px] font-black text-yellow-500 uppercase bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20 hover:bg-yellow-500/20 transition-all"><Files size={10} /> Batch</button>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => <ImageSlot key={i} idx={i} icon={Monitor} />)}
                  </div>
                </div>
                <div className="p-6 bg-yellow-500/5 rounded-[2rem] border border-yellow-500/10">
                   <h4 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Youtube size={12}/> High-CTR Mode</h4>
                   <p className="text-[9px] text-slate-400 leading-relaxed">Neural weights are biased towards high-contrast, bold text, and expressive facial reactions. Optimized for viral visual hooks.</p>
                </div>
              </div>
            ) : mode === AppMode.ACCESSORIES_GENERATOR ? (
              <div className="space-y-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><Gem size={14} className="text-emerald-400" /> Reference Assets</label>
                    <button onClick={() => handleBatchTrigger(0, 3)} className="flex items-center gap-1 text-[8px] font-black text-emerald-400 uppercase bg-emerald-400/10 px-2 py-1 rounded-lg border border-emerald-400/20 hover:bg-emerald-400/20 transition-all"><Files size={10} /> Batch</button>
                  </div>
                  <div className="grid grid-cols-3 gap-4">{[0,1,2].map(i => <ImageSlot key={i} idx={i} icon={Package} />)}</div>
                </div>
                <div className="p-6 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10">
                  <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Sparkles size={12}/> Material Logic</h4>
                  <p className="text-[9px] text-slate-400 leading-relaxed font-medium">Use @image0 to @image2 to anchor materials. For necklaces, specify "worn on neck" or "flat lay" in your instructions.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><User size={14} className="text-yellow-500" /> Identity Seeds</label>
                  <div className="grid grid-cols-3 gap-4">{[0,1,2].map(i => <ImageSlot key={i} idx={i} label={`Seed ${i+1}`} icon={Fingerprint} />)}</div>
                </div>
                {isSoloMode ? (
                  <div className="space-y-10">
                    <div className="space-y-4">
                      <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><Camera size={14} className="text-emerald-500" /> Source Image</label>
                      <div className="w-full aspect-video"><ImageSlot idx={3} label="Master Source" icon={ImageIcon} /></div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><Layers size={14} className="text-blue-500" /> Scene Assets</label>
                      <div className="grid grid-cols-3 gap-4">{[4,5,6,7,8,9].map(i => <ImageSlot key={i} idx={i} />)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><Layers size={14} className="text-emerald-500" /> Scene Reference</label>
                    <div className="grid grid-cols-3 gap-4">{[3,4,5,6,7,8,9,10,11].map(i => <ImageSlot key={i} idx={i} />)}</div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4 relative">
                <div className="flex items-center justify-between"><label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Surgical Instructions</label><button onClick={() => setIsPromptFullscreen(true)} className="text-yellow-500 text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><Maximize2 size={12}/> Pro Weaver</button></div>
                <div className="relative">
                  <textarea ref={textareaRef} value={prompt} onChange={handlePromptChange} placeholder={mode === AppMode.THUMBNAIL_CREATOR ? "Create a YouTube thumbnail for a tech review... using @image0 style..." : "Describe the modifications..."} className="w-full h-32 bg-[#0a0f1d] border border-white/5 rounded-[2rem] p-6 text-sm text-slate-200 focus:outline-none focus:border-yellow-500/50 resize-none custom-scrollbar transition-all" />
                  {showMentions && !isPromptFullscreen && <MentionList />}
                </div>
            </div>

            <div className="space-y-6 bg-yellow-500/5 p-8 rounded-[3rem] border border-yellow-500/10 shadow-2xl">
              <div className="flex items-center gap-3"><Cpu size={18} className="text-yellow-500" /><span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Neural Engine v4</span></div>
              <div className="space-y-5">
                 {[{ icon: Thermometer, label: 'Temp', val: settings.temperature, set: v => onUpdateSettings({...settings, temperature: v}), max: 1.5, step: 0.1 },
                   { icon: RefreshCcw, label: 'Variation', val: settings.variation, set: v => onUpdateSettings({...settings, variation: v}), max: 1, step: 0.05 },
                   { icon: Dna, label: 'DNA Lock', val: settings.faceFidelity, set: v => onUpdateSettings({...settings, faceFidelity: v}), max: 1, step: 0.01 },
                   { icon: ShieldCheck, label: 'Strictness', val: settings.strictness, set: v => onUpdateSettings({...settings, strictness: v}), max: 1, step: 0.01 }].map(s => (
                   <div key={s.label} className="space-y-2">
                     <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest"><span>{s.label}</span><span>{s.val}</span></div>
                     <input type="range" min="0" max={s.max} step={s.step} value={s.val} onChange={e => s.set(parseFloat(e.target.value))} className="w-full accent-yellow-500 h-1 bg-white/5 rounded-full appearance-none" />
                   </div>
                 ))}
                 <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase">Ratio</label>
                    <select 
                      value={settings.aspectRatio} 
                      onChange={e => onUpdateSettings({...settings, aspectRatio: e.target.value as ValidAspectRatio})} 
                      className="w-full bg-[#0d1324] border border-white/5 rounded-xl px-2 py-2 text-[9px] font-bold text-white"
                    >
                      {mode === AppMode.THUMBNAIL_CREATOR ? (
                        <>
                          <option value="16:9">16:9 (YouTube)</option>
                          <option value="9:16">9:16 (Reel/Shorts)</option>
                        </>
                      ) : (
                        <>
                          <option value="Original">Original</option>
                          <option value="1:1">1:1</option>
                          <option value="16:9">16:9</option>
                          <option value="9:16">9:16</option>
                          <option value="2:3">2:3</option>
                          <option value="3:2">3:2</option>
                          <option value="4:5">4:5</option>
                          <option value="5:4">5:4</option>
                          <option value="21:9">21:9</option>
                        </>
                      )}
                    </select>
                    </div>
                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase">Style</label><select value={settings.stylePreset} onChange={e => onUpdateSettings({...settings, stylePreset: e.target.value})} className="w-full bg-[#0d1324] border border-white/5 rounded-xl px-2 py-2 text-[9px] font-bold text-white"><option value="Photorealistic">Photorealistic</option><option value="Cinematic">Cinematic</option><option value="Digital Art">Digital Art</option></select></div>
                 </div>
                 <div className="pt-4 flex items-center justify-between border-t border-white/5"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Film size={12}/> Film Grain</label><button onClick={() => onUpdateSettings({...settings, enableFilmGrain: !settings.enableFilmGrain})} className={`w-10 h-5 rounded-full transition-all relative ${settings.enableFilmGrain ? 'bg-yellow-500' : 'bg-white/10'}`}><div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.enableFilmGrain ? 'left-6' : 'left-1'}`} /></button></div>
              </div>
            </div>
        </div>
        <div className="p-8 sticky bottom-0 bg-[#05080f] border-t border-white/5"><button disabled={isLoading} onClick={handleMagicClick} className="w-full py-8 bg-yellow-500 text-black font-black rounded-[3rem] flex items-center justify-center gap-4 transition-all hover:scale-105 shadow-2xl">{isLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={24} />}<span className="uppercase text-lg">Create Vision</span></button></div>
      </aside>

      <main className="flex-1 flex flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.03)_0%,_transparent_75%)]" />
        <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden">
          {(previewImage || isLoading) ? (
            <div className="relative group max-w-full max-h-full flex flex-col items-center justify-center">
              <div className="relative rounded-[4rem] overflow-hidden border border-white/5 bg-slate-900/50 shadow-[0_50px_150px_rgba(0,0,0,1)] min-w-[320px] min-h-[320px]">
                {previewImage && <img src={previewImage} className={`max-h-[65vh] object-contain transition-all duration-700 ${isLoading ? 'opacity-30 blur-sm scale-95' : 'opacity-100 scale-100'}`} />}
                {isLoading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md"><div className="relative w-48 h-48 mb-8 flex items-center justify-center"><div className="absolute inset-0 rounded-full border-[6px] border-white/5 border-t-yellow-500 animate-spin" /><Sparkles size={48} className="text-yellow-500 animate-pulse" /></div><span className="text-[14px] font-black text-white uppercase tracking-[0.4em]">{Math.round(progress)}% Synthesis</span></div>}
                {previewImage && !isLoading && (
                  <div className="absolute inset-x-0 bottom-8 flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button onClick={() => {const l=document.createElement('a'); l.href=previewImage!; l.download='banana.png'; l.click();}} className="px-6 py-3 bg-[#10b981] text-black font-black uppercase rounded-2xl text-[9px] flex items-center gap-2 shadow-xl"><Download size={14} /> Export</button>
                    <button onClick={() => setIsFullscreenPreview(true)} className="px-6 py-3 bg-blue-500 text-white font-black uppercase rounded-2xl text-[9px] flex items-center gap-2 shadow-xl"><Maximize2 size={14} /> View</button>
                    <button onClick={() => openEditor(previewImage!, 0)} className="px-6 py-3 bg-yellow-500 text-black font-black uppercase rounded-2xl text-[9px] flex items-center gap-2 shadow-xl"><Scissors size={14} /> Refine</button>
                  </div>
                )}
              </div>
            </div>
          ) : <div className="flex flex-col items-center opacity-5"><BrainCircuit size={120} /><h4 className="text-4xl font-black mt-12 italic uppercase tracking-widest">Pipeline Idle</h4></div>}
        </div>
        <div className="shrink-0 w-full max-w-5xl pt-10 border-t border-white/5 flex flex-col gap-6">
           <div className="flex items-center justify-between px-4"><h5 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] flex items-center gap-3"><History size={14} className="text-yellow-500" /> Neural Archive</h5><button onClick={() => setShowFullGallery(true)} className="px-3 py-1.5 bg-white/5 hover:bg-yellow-500/10 border border-white/10 rounded-xl text-slate-500 hover:text-yellow-500 text-[8px] font-black uppercase tracking-widest transition-all">View Full Gallery</button></div>
           <div className="flex gap-4 overflow-x-auto pb-6 px-4 scrollbar-hide">{gallery.length > 0 ? gallery.map((item, idx) => (<button key={idx} onClick={() => onSelectFromGallery(item.url)} className={`shrink-0 w-24 h-24 rounded-[1.5rem] overflow-hidden border-2 transition-all hover:scale-110 ${previewImage === item.url ? 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)]' : 'border-white/5 grayscale opacity-40 hover:opacity-100 hover:grayscale-0'}`}><img src={item.url} className="w-full h-full object-cover" /></button>)) : <div className="flex items-center gap-4 text-slate-800 opacity-20 py-8 px-4 border-2 border-dashed border-slate-800 rounded-[2rem] w-full justify-center"><Database size={24} /><span className="text-[11px] font-black uppercase tracking-widest">Vault Empty</span></div>}</div>
        </div>
      </main>

      {/* Fullscreen Preview Modal */}
      {isFullscreenPreview && previewImage && (
        <div className="fixed inset-0 z-[5000] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-12 animate-in fade-in duration-300">
          <button onClick={() => setIsFullscreenPreview(false)} className="absolute top-10 right-10 p-4 bg-white/5 hover:bg-red-500 hover:text-white rounded-full transition-all text-slate-400 z-[5010] shadow-2xl"><X size={32} /></button>
          <div className="relative w-full h-full flex flex-col items-center justify-center gap-8">
            <img src={previewImage} className="max-w-full max-h-[85vh] object-contain rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,1)] border border-white/10" />
            <div className="flex gap-4">
              <button onClick={() => {const l=document.createElement('a'); l.href=previewImage; l.download='banana_pro.png'; l.click();}} className="px-10 py-5 bg-[#10b981] text-black font-black uppercase rounded-2xl flex items-center gap-3 shadow-2xl hover:scale-105 transition-all tracking-widest"><Download size={20} /> Download</button>
              <button onClick={() => {reuseImage(previewImage); setIsFullscreenPreview(false);}} className="px-10 py-5 bg-blue-500 text-white font-black uppercase rounded-2xl flex items-center gap-3 shadow-2xl hover:scale-105 transition-all tracking-widest"><RefreshCcw size={20} /> Reuse</button>
            </div>
          </div>
        </div>
      )}

      {editingImage && (
          <div className="fixed inset-0 z-[2000] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-7xl h-[92vh] bg-[#05080f] border border-white/10 rounded-[4rem] flex overflow-hidden shadow-2xl">
              <div className="flex-1 flex flex-col border-r border-white/5 bg-black/20">
                <div className="px-10 py-6 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-md"><div className="flex items-center gap-4"><Scissors size={24} className="text-yellow-500" /><h3 className="text-xl font-black text-white uppercase italic tracking-tight">Biometric Refiner Pro</h3></div><button onClick={() => setEditingImage(null)} className="p-3 hover:bg-red-500/20 rounded-full text-slate-400 hover:text-red-500 transition-all"><X size={24} /></button></div>
                <div className="flex-1 flex items-center justify-center p-12 overflow-hidden relative"><img src={editingImage} className="max-w-full max-h-[60vh] object-contain shadow-2xl transition-all" style={{ filter: `brightness(${editorBrightness}%) contrast(${editorExposure}%) grayscale(${editorSharpness < 0 ? Math.abs(editorSharpness) : 0}%)`, transform: `rotate(${editorRotation}deg) scaleX(${editorFlipH ? -1 : 1})` }} /></div>
                <div className="p-10 bg-[#0d1324] border-t border-white/5"><div className="grid grid-cols-2 gap-x-12 gap-y-6">{[{ dir: 'Top', val: cropT, set: setCropT }, { dir: 'Bottom', val: cropB, set: setCropB }, { dir: 'Left', val: cropL, set: setCropL }, { dir: 'Right', val: cropR, set: setCropR }].map((c) => (<div key={c.dir} className="space-y-3"><div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-500 uppercase">{c.dir} Boundary</span><span className="text-[10px] font-black text-yellow-500">{c.val}%</span></div><input type="range" min="0" max="80" step="1" value={c.val} onChange={e => c.set(parseInt(e.target.value))} className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-yellow-500" /></div>))}</div></div>
              </div>
              <div className="w-[400px] bg-[#0a0f1d] p-10 flex flex-col gap-10">
                 <div className="space-y-6"><label className="text-[10px] font-black text-slate-500 uppercase">Orient</label><div className="grid grid-cols-2 gap-4"><button onClick={() => setEditorRotation(r => (r + 90) % 360)} className="flex flex-col items-center gap-3 p-6 bg-white/5 rounded-3xl hover:bg-white/10 border border-white/5 transition-all"><RotateCw size={24} /><span className="text-[9px] font-black uppercase">Rotate</span></button><button onClick={() => setEditorFlipH(!editorFlipH)} className="flex flex-col items-center gap-3 p-6 bg-white/5 rounded-3xl hover:bg-white/10 border border-white/5 transition-all"><Move size={24} /><span className="text-[9px] font-black uppercase">Flip</span></button></div></div>
                 <div className="space-y-8 flex-1"><label className="text-[10px] font-black text-slate-500 uppercase">Refine</label><div className="space-y-10">{[{ label: 'Brightness', val: editorBrightness, set: setEditorBrightness }, { label: 'Exposure', val: editorExposure, set: setEditorExposure }, { label: 'Sharpness', val: editorSharpness, set: setEditorSharpness, min: -100, max: 0 }].map(ctrl => (<div key={ctrl.label} className="space-y-4"><div className="flex justify-between"><span className="text-[10px] font-black text-slate-400 uppercase">{ctrl.label}</span><span className="text-[10px] text-white font-black">{ctrl.val}%</span></div><input type="range" min={ctrl.min ?? 50} max={ctrl.max ?? 150} value={ctrl.val} onChange={e => ctrl.set(parseInt(e.target.value))} className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-yellow-500" /></div>))}</div></div>
                 <button onClick={() => finalizeEditing('save')} className="w-full py-6 bg-yellow-500 text-black font-black rounded-3xl uppercase tracking-widest text-[11px] hover:scale-[1.02] transition-all shadow-2xl">Lock Selection</button>
              </div>
            </div>
          </div>
        )}

      {isPromptFullscreen && (
        <div className="fixed inset-0 z-[2000] bg-[#020408] flex animate-in fade-in zoom-in-95 duration-500">
           <div className="w-1/2 flex flex-col border-r border-white/5 p-16 relative bg-[#05080f]">
              <div className="flex items-center justify-between mb-12"><div className="flex items-center gap-6 text-white uppercase italic font-black"><BrainCircuit size={40} className="text-yellow-500" /><h2 className="text-3xl">Latent Weaver Pro</h2></div><button onClick={() => setIsPromptFullscreen(false)} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all"><X size={24}/></button></div>
              <div className="flex-1 relative"><textarea ref={fullscreenTextareaRef} autoFocus value={prompt} onChange={handlePromptChange} className="w-full h-full bg-[#0a0f1d] border border-white/5 rounded-[4rem] p-16 text-3xl text-slate-100 focus:outline-none focus:border-yellow-500/50 resize-none custom-scrollbar font-medium" />{showMentions && <MentionList isFullscreen={true} />}</div>
              <div className="mt-12"><button onClick={handleMagicClick} disabled={isLoading} className="w-full py-10 bg-yellow-500 text-black font-black uppercase text-xl rounded-[3rem] shadow-2xl transition-all hover:scale-[1.02]">{isLoading ? <Loader2 className="animate-spin" /> : 'Create Vision'}</button></div>
           </div>
           <div className="w-1/2 flex flex-col bg-black relative p-16"><div className="flex-1 flex items-center justify-center">{previewImage ? <img src={previewImage} className={`max-w-full max-h-full object-contain rounded-[4rem] border border-white/5 transition-all duration-1000 ${isLoading ? 'opacity-30 blur-2xl' : ''}`} /> : <div className="text-slate-900 italic font-black text-6xl tracking-widest uppercase opacity-20">Void Pipeline</div>}</div></div>
        </div>
      )}

      {showSeedCreationModal && <SeedPromptModal onConfirm={handleSeedModalConfirm} onCancel={() => {setShowSeedCreationModal(false); setUploadSlotIdx(null);}} />}
      
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => { const r = new FileReader(); r.onload = () => openEditor(r.result as string, uploadSlotIdx!); const f = e.target.files?.[0]; if (f) r.readAsDataURL(f as Blob); e.target.value = ''; }} />
      <input type="file" ref={batchAssetsInputRef} className="hidden" accept="image/*" multiple onChange={handleBatchFileChange} />
      <canvas ref={editorCanvasRef} className="hidden" />
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        input[type=range] { -webkit-appearance: none; background: rgba(255,255,255,0.05); border-radius: 10px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: currentColor; cursor: pointer; border: 3px solid #05080f; }
      `}} />
    </div>
  );
};

export default EditorWorkspace;