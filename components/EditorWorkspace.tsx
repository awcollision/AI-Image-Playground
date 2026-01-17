
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
  Files, Gem, Package, Youtube, ThumbsUp, ThumbsDown, Zap, Map,
  Check
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
  onFeedback?: (type: 'like' | 'dislike', item: GalleryItem) => void;
}

const MentionList: React.FC<{ 
  isFullscreen?: boolean;
  mentions: { tag: string; data: string; label: string }[];
  onSelect: (tag: string) => void;
}> = ({ isFullscreen = false, mentions, onSelect }) => (
  <div className={`absolute ${isFullscreen ? 'left-0 top-[100%] mt-2 w-full' : 'bottom-full left-0 mb-4 w-64'} bg-[#0d1324] border border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-[6000] overflow-hidden flex flex-col animate-in slide-in-from-bottom-2`}>
    <div className="px-4 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Neural Indices</span>
      <AtSign size={12} className="text-yellow-500" />
    </div>
    <div className="max-h-64 overflow-y-auto custom-scrollbar">
      {mentions.length > 0 ? mentions.map((m, i) => (
        <button 
          key={i} 
          onMouseDown={(e) => { e.preventDefault(); onSelect(m.tag); }}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-yellow-500/10 transition-colors border-b border-white/5 last:border-0 group text-left"
        >
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0">
            <img src={m.data} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col items-start truncate">
            <span className="text-xs font-bold text-slate-200 group-hover:text-yellow-500 transition-colors">@{m.tag}</span>
            <span className="text-[8px] font-black uppercase tracking-tighter text-slate-500">{m.label}</span>
          </div>
        </button>
      )) : (
        <div className="px-4 py-8 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">No active indices</div>
      )}
    </div>
  </div>
);

const ImageSlot: React.FC<{
  idx: number;
  label?: string;
  icon?: any;
  data: string;
  onDrop: (file: File, idx: number) => void;
  onClick: () => void;
  onClear: () => void;
}> = ({ idx, label, icon: Icon, data, onDrop, onClick, onClear }) => {
  const [isDragging, setIsDragging] = useState(false);
  const handleDragOver = (e: any) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: any) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.[0]) onDrop(e.dataTransfer.files[0], idx);
  };

  return (
    <div className="relative aspect-square group">
      <div 
        onClick={onClick} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        className={`w-full h-full bg-slate-800/20 border rounded-[1.5rem] overflow-hidden transition-all flex flex-col items-center justify-center cursor-pointer
          ${isDragging ? 'border-yellow-500 bg-yellow-500/10' : 'border-white/5 hover:border-yellow-500/30'}
          ${data ? 'shadow-lg border-white/20' : ''}`}
      >
        {data ? <img src={data} className="w-full h-full object-cover pointer-events-none" /> : (
          <div className={`flex flex-col items-center gap-2 transition-opacity ${isDragging ? 'opacity-100 text-yellow-500' : 'opacity-20'}`}>
            {Icon ? <Icon size={18} /> : <Layers size={18} />}
            {label && <span className="text-[7px] font-black uppercase tracking-[0.2em]">{label}</span>}
          </div>
        )}
      </div>
      {data && <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="absolute -top-1 -right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"><X size={10} /></button>}
    </div>
  );
};

const EditorWorkspace: React.FC<Props> = ({ 
  mode, settings, negativePrompt, prompt, canUndo, canRedo, onUndo, onRedo,
  onUpdatePrompt, onCommitPrompt, neuralMemory, onUpdateSettings, 
  onUpdateNegativePrompt, onGenerate, isLoading, previewImage, 
  onSelectFromGallery, gallery, seeds, onBackToHome, onRemoveSeed, onRenameSeed,
  autoFillImage, onAutoFillConsumed, onAddSeed, onFeedback
}) => {
  const [uploadedImages, setUploadedImages] = useState<string[]>(new Array(24).fill(''));
  const [isSoloMode, setIsSoloMode] = useState(false);
  const [showFullGallery, setShowFullGallery] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [isPromptFullscreen, setIsPromptFullscreen] = useState(false);
  const [uploadSlotIdx, setUploadSlotIdx] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editorRotation, setEditorRotation] = useState(0);
  const [editorFlipH, setEditorFlipH] = useState(false);
  const [editorBrightness, setEditorBrightness] = useState(100);
  const [editorExposure, setEditorExposure] = useState(100);
  const [editorSaturation, setEditorSaturation] = useState(100);
  const [editorSharpness, setEditorSharpness] = useState(0);
  const [editorAddNoise, setEditorAddNoise] = useState(false);
  
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

  const currentGalleryItem = gallery.find(g => g.url === previewImage);

  useEffect(() => {
    if (isLoading) {
      setProgress(5);
      progressTimerRef.current = window.setInterval(() => {
        setProgress(prev => (prev < 98 ? prev + Math.random() * 1.5 : prev));
      }, 120);
    } else {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (progress > 0) { setProgress(100); setTimeout(() => setProgress(0), 600); }
    }
    return () => { if (progressTimerRef.current) clearInterval(progressTimerRef.current); };
  }, [isLoading]);

  useEffect(() => {
    if (autoFillImage && onAutoFillConsumed) {
      setUploadedImages(prev => { const n = [...prev]; n[0] = autoFillImage; return n; });
      onAutoFillConsumed();
    }
  }, [autoFillImage, onAutoFillConsumed]);

  const openEditor = (dataUrl: string, idx: number) => {
    setEditingImage(dataUrl); setUploadSlotIdx(idx); setEditorRotation(0); setEditorFlipH(false);
    setEditorBrightness(100); setEditorExposure(100); setEditorSaturation(100); setEditorSharpness(0);
    setEditorAddNoise(false); setCropT(0); setCropB(0); setCropL(0); setCropR(0);
  };

  const finalizeEditing = (modeAction: 'save' | 'reuse' = 'save') => {
    if (!editorCanvasRef.current || !editingImage || uploadSlotIdx === null) return;
    const canvas = editorCanvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      const sourceW = img.width * (1 - (cropL + cropR) / 100);
      const sourceH = img.height * (1 - (cropT + cropB) / 100);
      canvas.width = sourceW; canvas.height = sourceH;
      ctx.save();
      ctx.filter = `brightness(${editorBrightness}%) contrast(${editorExposure + (editorSharpness/4)}%) saturate(${editorSaturation}%)`;
      ctx.translate(sourceW / 2, sourceH / 2); ctx.rotate((editorRotation * Math.PI) / 180);
      if (editorFlipH) ctx.scale(-1, 1);
      ctx.drawImage(img, (cropL/100)*img.width, (cropT/100)*img.height, sourceW, sourceH, -sourceW/2, -sourceH/2, sourceW, sourceH);
      if (editorAddNoise) {
        ctx.restore(); ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = '#888';
        for (let i = 0; i < 5000; i++) ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 1, 1);
      } else { ctx.restore(); }
      const dataUrl = canvas.toDataURL('image/jpeg', 0.98);
      if (modeAction === 'reuse') reuseImage(dataUrl);
      else setUploadedImages(prev => { const n = [...prev]; n[uploadSlotIdx!] = dataUrl; return n; });
      setEditingImage(null);
    };
    img.src = editingImage;
  };

  const applyCropPreset = (preset: string) => {
    if (!editingImage) return;
    const img = new Image();
    img.onload = () => {
      const w = img.width; const h = img.height;
      const [targetW, targetH] = preset.split(':').map(Number);
      const targetRatio = targetW / targetH;
      const currentRatio = w / h;
      setCropT(0); setCropB(0); setCropL(0); setCropR(0);
      if (currentRatio > targetRatio) {
        const newW = h * targetRatio; const totalCropPercent = ((w - newW) / w) * 100;
        setCropL(totalCropPercent / 2); setCropR(totalCropPercent / 2);
      } else if (currentRatio < targetRatio) {
        const newH = w / targetRatio; const totalCropPercent = ((h - newH) / h) * 100;
        setCropT(totalCropPercent / 2); setCropB(totalCropPercent / 2);
      }
    };
    img.src = editingImage;
  };

  const handleBatchTrigger = (start: number, limit: number) => {
    setBatchTarget({ start, limit });
    setUploadSlotIdx(null);
    if (batchAssetsInputRef.current) batchAssetsInputRef.current.click();
  };

  const handleBatchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !batchTarget) return;
    const filesArray = Array.from(files).slice(0, batchTarget.limit);
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
          setUploadedImages(newImages); setBatchTarget(null);
        }
      };
      reader.readAsDataURL(file as Blob);
    });
    e.target.value = '';
  };

  const reuseImage = (img: string) => {
    let range = [0, 8];
    if (mode === AppMode.PORTRAIT_GENERATOR) range = [0, 8];
    else if (mode === AppMode.GROUP_PHOTO) range = [7, 21];
    
    setUploadedImages(prev => {
      const n = [...prev];
      let targetIdx = -1;
      for (let i = range[0]; i <= range[1]; i++) { if (!n[i]) { targetIdx = i; break; } }
      if (targetIdx === -1) targetIdx = range[0];
      n[targetIdx] = img;
      return n;
    });
  };

  const clearSection = (indices: number[]) => {
    setUploadedImages(prev => { const n = [...prev]; indices.forEach(idx => n[idx] = ''); return n; });
  };

  const getSemanticName = (idx: number): { tag: string; label: string } => {
    if (mode === AppMode.PORTRAIT_GENERATOR) {
      if (idx < 9) return { tag: `face${idx + 1}`, label: `Face ${idx + 1}` };
      if (idx >= 9 && idx < 15) return { tag: `style${idx - 8}`, label: `Style ${idx - 8}` };
    } else if (mode === AppMode.GROUP_PHOTO) {
      if (idx < 6) {
        const seed = seeds[idx];
        return { 
          tag: seed?.name.replace(/\s+/g, '') || `identity${idx + 1}`, 
          label: seed?.name || `Identity ${idx + 1}` 
        };
      }
      if (idx === 6) return { tag: 'scene', label: 'Scene Reference' };
      if (idx >= 7 && idx <= 21) return { tag: `style${idx - 6}`, label: `Style ${idx - 6}` };
    } else if (mode === AppMode.ACCESSORIES_GENERATOR) {
      if (idx < 3) return { tag: `ref${idx + 1}`, label: `Ref ${idx + 1}` };
      return { tag: `asset${idx - 2}`, label: `Asset ${idx - 2}` };
    } else if (mode === AppMode.THUMBNAIL_CREATOR) {
      return { tag: `insp${idx + 1}`, label: `Insp ${idx + 1}` };
    }
    return { tag: `image${idx}`, label: `Image ${idx}` };
  };

  const handleMagicClick = async () => {
    if (!prompt.trim() && uploadedImages.filter(Boolean).length === 0) return;
    let finalImages: string[] = [];
    let processedPrompt = prompt;
    const seenImages = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const semantic = getSemanticName(i);
      const tag = `@${semantic.tag}`;
      if (processedPrompt.includes(tag)) {
        processedPrompt = processedPrompt.replace(new RegExp(tag, 'g'), `[REFERENCE_IMAGE_${i}]`);
        const imgData = uploadedImages[i];
        if (imgData && !seenImages.has(imgData)) { finalImages.push(imgData); seenImages.add(imgData); }
      }
    }
    if (finalImages.length === 0) uploadedImages.forEach(img => { if (img && !seenImages.has(img)) { finalImages.push(img); seenImages.add(img); } });
    onGenerate(processedPrompt, finalImages);
  };

  const handlePromptChange = (e: any) => {
    const value = e.target.value; const pos = e.target.selectionStart;
    onUpdatePrompt(value);
    const lastAt = value.substring(0, pos).lastIndexOf('@');
    if (lastAt !== -1 && !value.substring(lastAt, pos).includes(' ')) {
      setShowMentions(true); setMentionFilter(value.substring(lastAt + 1, pos).toLowerCase());
    } else setShowMentions(false);
  };

  const insertMention = (mention: string) => {
    const ref = isPromptFullscreen ? fullscreenTextareaRef : textareaRef;
    if (!ref.current) return;
    const pos = ref.current.selectionStart;
    const lastAt = prompt.substring(0, pos).lastIndexOf('@');
    const next = prompt.substring(0, lastAt) + '@' + mention + ' ' + prompt.substring(pos);
    onUpdatePrompt(next); onCommitPrompt(next); setShowMentions(false);
    setTimeout(() => ref.current?.focus(), 0);
  };

  const getMentionPool = () => {
    const pool: any[] = []; const seenData = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const data = uploadedImages[i];
      if (data && !seenData.has(data)) {
        seenData.add(data); const semantic = getSemanticName(i);
        pool.push({ tag: semantic.tag, data, label: semantic.label });
      }
    }
    return pool.filter(m => m.tag.toLowerCase().includes(mentionFilter));
  };

  const handleDropImage = (file: File, idx: number) => {
    const reader = new FileReader();
    reader.onload = (e) => { const r = e.target?.result as string; if (r) setUploadedImages(prev => { const n = [...prev]; n[idx] = r; return n; }); };
    reader.readAsDataURL(file);
  };

  const renderImageSlot = (idx: number, icon?: any) => (
    <ImageSlot key={idx} idx={idx} label={getSemanticName(idx).label} icon={icon} data={uploadedImages[idx]} onDrop={handleDropImage} onClick={() => uploadedImages[idx] ? openEditor(uploadedImages[idx], idx) : handleUploadTrigger(idx)} onClear={() => setUploadedImages(prev => { const n = [...prev]; n[idx] = ''; return n; })} />
  );

  const handleUploadTrigger = (idx: number) => {
    setUploadSlotIdx(idx); setBatchTarget(null);
    if (mode === AppMode.GROUP_PHOTO && idx < 6) setShowSeedCreationModal(true);
    else if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleSeedConfirm = (data: string, name: string, tags: string[]) => {
    if (uploadSlotIdx !== null) {
      setUploadedImages(prev => {
        const n = [...prev];
        n[uploadSlotIdx] = data;
        return n;
      });
      if (onAddSeed) onAddSeed(data, name, tags);
      setShowSeedCreationModal(false);
    }
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
                    <div className="flex items-center gap-3">
                      <button onClick={() => clearSection([0,1,2,3,4,5,6,7,8])} className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors">Clear All</button>
                      <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><UserCheck size={14} className="text-yellow-500" /> Face References</label>
                    </div>
                    <button onClick={() => handleBatchTrigger(0, 9)} className="flex items-center gap-1 text-[8px] font-black text-yellow-500 uppercase bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20 hover:bg-yellow-500/20 transition-all"><Files size={10} /> Batch</button>
                  </div>
                  <div className="grid grid-cols-3 gap-4">{[0,1,2,3,4,5,6,7,8].map(i => renderImageSlot(i, Fingerprint))}</div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => clearSection([9,10,11,12,13,14])} className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors">Clear All</button>
                      <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><Paintbrush size={14} className="text-emerald-500" /> Style References</label>
                    </div>
                    <button onClick={() => handleBatchTrigger(9, 6)} className="flex items-center gap-1 text-[8px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"><Files size={10} /> Batch</button>
                  </div>
                  <div className="grid grid-cols-3 gap-4">{[9,10,11,12,13,14].map(i => renderImageSlot(i, Palette))}</div>
                </div>
              </div>
            ) : mode === AppMode.ACCESSORIES_GENERATOR ? (
              <div className="space-y-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => clearSection([0,1,2])} className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors">Clear All</button>
                      <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><Gem size={14} className="text-emerald-400" /> Reference Assets</label>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">{[0,1,2].map(i => renderImageSlot(i, Package))}</div>
                </div>
                <div className="p-6 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10 space-y-3">
                   <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={12}/> Micro-Scale Logic</h4>
                   <p className="text-[9px] text-slate-400 leading-relaxed font-medium">Use @ref1-3 to anchor accessories. High-precision Detail Bias is active for jewelry and micro-components.</p>
                </div>
              </div>
            ) : mode === AppMode.GROUP_PHOTO ? (
              <div className="space-y-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => clearSection([0,1,2,3,4,5])} className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors">Clear All</button>
                      <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><User size={14} className="text-yellow-500" /> Identity Seeds</label>
                    </div>
                    <button onClick={() => handleBatchTrigger(0, 6)} className="flex items-center gap-1 text-[8px] font-black text-yellow-500 uppercase bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20 hover:bg-yellow-500/20 transition-all"><Files size={10} /> Batch</button>
                  </div>
                  <div className="grid grid-cols-3 gap-4">{[0,1,2,3,4,5].map(i => renderImageSlot(i, Fingerprint))}</div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><Map size={14} className="text-blue-500" /> Scene Reference</label>
                  </div>
                  <div className="grid grid-cols-3 gap-4">{renderImageSlot(6, Map)}</div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => clearSection([7,8,9,10,11,12,13,14,15,16,17,18,19,20,21])} className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors">Clear All</button>
                      <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><Palette size={14} className="text-emerald-500" /> Style References</label>
                    </div>
                    <button onClick={() => handleBatchTrigger(7, 15)} className="flex items-center gap-1 text-[8px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"><Files size={10} /> Batch</button>
                  </div>
                  <div className="grid grid-cols-3 gap-4">{[7,8,9,10,11,12,13,14,15,16,17,18,19,20,21].map(i => renderImageSlot(i, Palette))}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button onClick={() => clearSection([0,1,2])} className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors">Clear All</button>
                    <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><User size={14} className="text-yellow-500" /> Identity Seeds</label>
                  </div>
                  <div className="grid grid-cols-3 gap-4">{[0,1,2].map(i => renderImageSlot(i, Fingerprint))}</div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button onClick={() => clearSection([3,4,5,6,7,8,9,10,11])} className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors">Clear All</button>
                    <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]"><Layers size={14} className="text-emerald-500" /> Image References</label>
                  </div>
                  <div className="grid grid-cols-3 gap-4">{renderImageSlot(3, ImageIcon)}{[4,5,6,7,8,9,10,11].map(i => renderImageSlot(i))}</div>
                </div>
              </div>
            )}

            <div className="space-y-4 relative">
                <div className="flex items-center justify-between"><label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Surgical Instructions</label><button onClick={() => setIsPromptFullscreen(true)} className="text-yellow-500 text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><Maximize2 size={12}/> Pro Weaver</button></div>
                <textarea ref={textareaRef} value={prompt} onChange={handlePromptChange} placeholder="Describe changes... Use @ to mention references" className="w-full h-32 bg-[#0a0f1d] border border-white/5 rounded-[2rem] p-6 text-sm text-slate-200 focus:outline-none focus:border-yellow-500/50 resize-none custom-scrollbar" />
                {showMentions && !isPromptFullscreen && <MentionList mentions={getMentionPool()} onSelect={insertMention} />}
            </div>

            <div className="space-y-6 bg-yellow-500/5 p-8 rounded-[3rem] border border-yellow-500/10 shadow-2xl">
              <div className="flex items-center gap-3"><Cpu size={18} className="text-yellow-500" /><span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Neural Engine v4.1</span></div>
              <div className="space-y-5">
                 {[{ icon: Thermometer, label: 'Temp', val: settings.temperature, set: v => onUpdateSettings({...settings, temperature: v}), max: 1.5, step: 0.1 },
                   { icon: Dna, label: 'DNA Lock', val: settings.faceFidelity, set: v => onUpdateSettings({...settings, faceFidelity: v}), max: 1, step: 0.01 },
                   { icon: ShieldCheck, label: 'Strictness', val: settings.strictness, set: v => onUpdateSettings({...settings, strictness: v}), max: 1, step: 0.01 },
                   { icon: Zap, label: 'Micro-Detail', val: settings.microDetailBias || 0.8, set: v => onUpdateSettings({...settings, microDetailBias: v}), max: 1, step: 0.01 }].map(s => (
                   <div key={s.label} className="space-y-2">
                     <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest"><span>{s.label}</span><span>{s.val}</span></div>
                     <input type="range" min="0" max={s.max} step={s.step} value={s.val} onChange={e => s.set(parseFloat(e.target.value))} className="w-full accent-yellow-500 h-1 bg-white/5 rounded-full appearance-none" />
                   </div>
                 ))}
                 <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase">Ratio</label>
                    <select value={settings.aspectRatio} onChange={e => onUpdateSettings({...settings, aspectRatio: e.target.value as any})} className="w-full bg-[#0d1324] border border-white/5 rounded-xl px-2 py-2 text-[9px] font-bold text-white">
                      <option value="Original">Original</option>
                      <option value="1:1">1:1</option>
                      <option value="1:2">1:2</option>
                      <option value="16:9">16:9</option>
                      <option value="9:16">9:16</option>
                      <option value="2:3">2:3</option>
                      <option value="3:2">3:2</option>
                      <option value="4:5">4:5</option>
                      <option value="5:4">5:4</option>
                      <option value="21:9">21:9</option>
                    </select>
                    </div>
                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase">Style</label><select value={settings.stylePreset} onChange={e => onUpdateSettings({...settings, stylePreset: e.target.value})} className="w-full bg-[#0d1324] border border-white/5 rounded-xl px-2 py-2 text-[9px] font-bold text-white"><option value="Photorealistic">Photorealistic</option><option value="Cinematic">Cinematic</option></select></div>
                 </div>
                 <div className="space-y-2 pt-2"><label className="text-[9px] font-black text-slate-500 uppercase">Quality</label>
                   <select value={settings.imageSize} onChange={e => onUpdateSettings({...settings, imageSize: e.target.value as any})} className="w-full bg-[#0d1324] border border-white/5 rounded-xl px-2 py-2 text-[9px] font-bold text-white">
                     <option value="1K">1K - standard</option>
                     <option value="2K">2K - high</option>
                     <option value="4K">4K - ultra</option>
                     <option value="8K">8K - insane</option>
                   </select>
                 </div>
              </div>
            </div>
        </div>
        <div className="p-8 sticky bottom-0 bg-[#05080f] border-t border-white/5"><button disabled={isLoading} onClick={handleMagicClick} className="w-full py-8 bg-yellow-500 text-black font-black rounded-[3rem] flex items-center justify-center gap-4 transition-all hover:scale-105 shadow-2xl">{isLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={24} />}<span className="uppercase text-lg">Create Vision</span></button></div>
      </aside>

      <main className="flex-1 flex flex-col items-center justify-center p-12 relative overflow-hidden h-full">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.03)_0%,_transparent_75%)]" />
        
        <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden">
          {(previewImage || isLoading) ? (
            <div className="relative group max-w-full max-h-full flex items-center justify-center">
              <div className="relative rounded-[4rem] overflow-hidden border border-white/5 bg-slate-900/50 shadow-[0_50px_150px_rgba(0,0,0,1)] min-w-[320px] min-h-[320px]">
                {previewImage && <img src={previewImage} className={`max-h-[65vh] object-contain transition-all duration-700 ${isLoading ? 'opacity-30 blur-sm scale-95' : 'opacity-100 scale-100'}`} />}
                
                {previewImage && !isLoading && currentGalleryItem && (
                  <div className="absolute bottom-10 right-10 flex flex-col gap-3 z-50 animate-in slide-in-from-bottom-4">
                    <button onClick={() => onFeedback && onFeedback('like', currentGalleryItem)} className={`p-4 rounded-full backdrop-blur-md border shadow-xl transition-all hover:scale-110 active:scale-90 ${currentGalleryItem.feedback === 'like' ? 'bg-green-500 text-black border-green-500' : 'bg-black/40 text-white border-white/10 hover:bg-green-500/20'}`}><ThumbsUp size={24} fill={currentGalleryItem.feedback === 'like' ? 'currentColor' : 'none'} /></button>
                    <button onClick={() => onFeedback && onFeedback('dislike', currentGalleryItem)} className={`p-4 rounded-full backdrop-blur-md border shadow-xl transition-all hover:scale-110 active:scale-90 ${currentGalleryItem.feedback === 'dislike' ? 'bg-red-500 text-white border-red-500' : 'bg-black/40 text-white border-white/10 hover:bg-red-500/20'}`}><ThumbsDown size={24} fill={currentGalleryItem.feedback === 'dislike' ? 'currentColor' : 'none'} /></button>
                  </div>
                )}

                {isLoading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md"><div className="relative w-48 h-48 mb-8 flex items-center justify-center"><div className="absolute inset-0 rounded-full border-[6px] border-white/5 border-t-yellow-500 animate-spin" /><Sparkles size={48} className="text-yellow-500 animate-pulse" /></div><span className="text-[14px] font-black text-white uppercase tracking-[0.4em]">{Math.round(progress)}% Synthesis</span></div>}
                
                {previewImage && !isLoading && (
                  <>
                    <button 
                      onClick={() => setIsFullscreenPreview(true)} 
                      className="absolute top-8 left-8 p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95"
                    >
                      <Maximize2 size={20} />
                    </button>
                    <div className="absolute inset-x-0 bottom-8 flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <button onClick={() => {const l=document.createElement('a'); l.href=previewImage!; l.download='astra_gen.png'; l.click();}} className="px-6 py-3 bg-[#10b981] text-black font-black uppercase rounded-2xl text-[9px] flex items-center gap-2 shadow-xl hover:scale-105 transition-transform"><Download size={14} /> Export</button>
                      <button onClick={() => reuseImage(previewImage!)} className="px-6 py-3 bg-blue-500 text-white font-black uppercase rounded-2xl text-[9px] flex items-center gap-2 shadow-xl hover:scale-105 transition-transform"><RefreshCcw size={14} /> Reuse</button>
                      <button onClick={() => openEditor(previewImage!, 0)} className="px-6 py-3 bg-yellow-500 text-black font-black uppercase rounded-2xl text-[9px] flex items-center gap-2 shadow-xl hover:scale-105 transition-transform"><Scissors size={14} /> Refine</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : <div className="flex flex-col items-center opacity-5"><BrainCircuit size={120} /><h4 className="text-4xl font-black mt-12 italic uppercase tracking-widest">Pipeline Idle</h4></div>}
        </div>

        <div className="shrink-0 w-full max-w-5xl pt-10 border-t border-white/5 flex flex-col gap-6 z-10 bg-gradient-to-t from-[#020408] to-transparent">
           <div className="flex items-center justify-between px-4">
             <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] flex items-center gap-3">
               <History size={14} className="text-yellow-500" /> Neural Archive
             </h5>
             <button onClick={() => setShowFullGallery(true)} className="px-3 py-1.5 bg-white/5 hover:bg-yellow-500/10 border border-white/10 rounded-xl text-slate-500 hover:text-yellow-500 text-[8px] font-black uppercase tracking-widest transition-all">View Full Vault</button>
           </div>
           <div className="flex gap-4 overflow-x-auto pb-6 px-4 scrollbar-hide">
             {gallery.length > 0 ? gallery.map((item, idx) => (
               <button key={idx} onClick={() => onSelectFromGallery(item.url)} className={`shrink-0 w-24 h-24 rounded-[1.5rem] overflow-hidden border-2 transition-all hover:scale-110 active:scale-95 ${previewImage === item.url ? 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.4)]' : 'border-white/5 grayscale opacity-40 hover:opacity-100 hover:grayscale-0'}`}>
                 <img src={item.url} className="w-full h-full object-cover" />
               </button>
             )) : (
               <div className="flex items-center gap-4 text-slate-800 opacity-20 py-8 px-4 border-2 border-dashed border-slate-800 rounded-[2rem] w-full justify-center">
                 <Database size={24} /><span className="text-[11px] font-black uppercase tracking-widest">Vault Empty</span>
               </div>
             )}
           </div>
        </div>
      </main>

      {/* Full Screen Image Preview Modal */}
      {isFullscreenPreview && previewImage && (
        <div className="fixed inset-0 z-[6000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-10 animate-in fade-in zoom-in-95">
          <button onClick={() => setIsFullscreenPreview(false)} className="absolute top-10 right-10 p-4 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all z-[6010] border border-white/10"><X size={32} /></button>
          <div className="relative max-w-full max-h-full flex flex-col items-center gap-10">
            <img src={previewImage} className="max-w-full max-h-[80vh] object-contain rounded-[3rem] shadow-[0_50px_150px_rgba(0,0,0,1)] border border-white/10" />
            <div className="flex items-center gap-5">
              <button onClick={() => {const l=document.createElement('a'); l.href=previewImage!; l.download='astra_gen.png'; l.click();}} className="px-10 py-5 bg-[#10b981] text-black border border-[#10b981]/10 font-black uppercase tracking-[0.2em] rounded-3xl flex items-center gap-3 hover:scale-105 transition-all shadow-xl shadow-[#10b981]/20"><Download size={24} /> Export File</button>
              <button onClick={() => { reuseImage(previewImage!); setIsFullscreenPreview(false); }} className="px-10 py-5 bg-white/5 text-white border border-white/10 font-black uppercase tracking-[0.2em] rounded-3xl flex items-center gap-3 hover:bg-white/10 transition-all backdrop-blur-xl"><RefreshCcw size={24} /> Reuse Ref</button>
              <button onClick={() => { openEditor(previewImage!, 0); setIsFullscreenPreview(false); }} className="px-10 py-5 bg-yellow-500 text-black font-black uppercase tracking-[0.2em] rounded-3xl flex items-center gap-3 hover:scale-105 transition-all shadow-xl shadow-yellow-500/20"><Scissors size={24} /> Neural Refine</button>
            </div>
          </div>
        </div>
      )}

      {/* Full Vault Gallery Modal */}
      {showFullGallery && (
        <div className="fixed inset-0 z-[5500] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-10 animate-in fade-in slide-in-from-bottom-5">
          <div className="w-full max-w-7xl h-full flex flex-col gap-10">
            <header className="flex justify-between items-center border-b border-white/10 pb-8">
               <div className="flex flex-col gap-2">
                  <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter flex items-center gap-4"><Database size={40} className="text-yellow-500" /> Neural Vault</h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic">Browsing session-state generation archive</p>
               </div>
               <button onClick={() => setShowFullGallery(false)} className="p-4 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all border border-white/10"><X size={32} /></button>
            </header>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 pb-10">
               {gallery.map((item, i) => (
                 <div key={i} className="group/vault flex flex-col gap-5 bg-[#0d1324] p-6 rounded-[3rem] border border-white/5 hover:border-yellow-500/30 transition-all hover:bg-yellow-500/5">
                    <div className="relative aspect-square rounded-[2.5rem] overflow-hidden shadow-2xl">
                      <img src={item.url} className="w-full h-full object-cover transition-transform duration-700 group-hover/vault:scale-110" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/vault:opacity-100 flex items-center justify-center gap-4 transition-all">
                         <button onClick={() => { onSelectFromGallery(item.url); setShowFullGallery(false); }} className="p-4 bg-yellow-500 text-black rounded-full hover:scale-110 shadow-xl"><Check size={24} /></button>
                         <button onClick={() => { onSelectFromGallery(item.url); setIsFullscreenPreview(true); }} className="p-4 bg-white/10 rounded-full hover:bg-white/20 backdrop-blur-md"><Maximize2 size={24} /></button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-slate-400 line-clamp-2 leading-relaxed italic">"{item.prompt}"</p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="px-2 py-0.5 bg-white/5 rounded text-[8px] font-black text-slate-600 uppercase tracking-widest">{new Date(item.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                 </div>
               ))}
               {gallery.length === 0 && (
                 <div className="col-span-full h-[50vh] flex flex-col items-center justify-center text-slate-800 opacity-20">
                   <Database size={100} />
                   <h4 className="text-2xl font-black mt-8 uppercase tracking-[0.5em]">Vault Empty</h4>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {isPromptFullscreen && (
        <div className="fixed inset-0 z-[5000] bg-[#05080f]/98 backdrop-blur-3xl flex flex-col animate-in fade-in zoom-in-95">
          <header className="px-10 py-6 border-b border-white/5 flex items-center justify-between bg-black/20">
            <div className="flex items-center gap-4">
              <Maximize2 size={32} className="text-yellow-500" />
              <div>
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Pro Weaver Live</h3>
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Neural Compositor Engine Active</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button disabled={isLoading} onClick={handleMagicClick} className="px-10 py-4 bg-yellow-500 text-black font-black rounded-2xl uppercase tracking-widest text-[11px] shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3">{isLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />} Synthesize Vision</button>
              <button onClick={() => setIsPromptFullscreen(false)} className="p-4 bg-white/5 hover:bg-red-500/20 rounded-full text-slate-400 hover:text-red-500 transition-all border border-white/5"><X size={24} /></button>
            </div>
          </header>
          
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 bg-black/40 flex items-center justify-center p-10 relative">
               {previewImage ? (
                 <div className="relative group max-w-full max-h-full">
                    <img src={previewImage} className={`max-w-full max-h-[75vh] object-contain rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,1)] border border-white/10 transition-all ${isLoading ? 'opacity-30 blur-xl scale-95' : 'opacity-100 scale-100'}`} />
                    {isLoading && <div className="absolute inset-0 flex flex-col items-center justify-center"><Sparkles size={64} className="text-yellow-500 animate-pulse mb-6" /><span className="text-2xl font-black text-white uppercase tracking-[0.5em]">{Math.round(progress)}%</span></div>}
                 </div>
               ) : (
                 <div className="flex flex-col items-center opacity-10"><ImageIcon size={100} /><h4 className="text-2xl font-black mt-8 uppercase tracking-widest italic">Awaiting First Pulse</h4></div>
               )}
            </div>

            <div className="w-[500px] bg-[#0a0f1d] border-l border-white/10 flex flex-col h-full shadow-2xl relative">
              <div className="flex-1 flex flex-col p-8 space-y-6">
                 <div className="flex items-center justify-between"><label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Surgical Instructions</label><kbd className="px-2 py-1 bg-white/5 rounded-lg border border-white/10 text-slate-600 text-[9px] font-mono">⌘ + Enter</kbd></div>
                 <div className="flex-1 relative">
                   <textarea 
                     ref={fullscreenTextareaRef}
                     value={prompt} 
                     onChange={handlePromptChange}
                     onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleMagicClick(); } }}
                     placeholder="Inject logic... Use @ to tag references from your grid."
                     className="w-full h-full bg-[#05080f] border border-yellow-500/20 rounded-[2.5rem] p-8 text-xl font-medium text-slate-200 focus:outline-none focus:border-yellow-500 transition-all shadow-inner resize-none custom-scrollbar placeholder:text-slate-800"
                   />
                   {showMentions && <MentionList isFullscreen mentions={getMentionPool()} onSelect={insertMention} />}
                 </div>
              </div>
              <aside className="p-8 border-t border-white/5 bg-black/20 space-y-6">
                <div className="space-y-4">
                   <h5 className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.3em]">Latent Biometrics</h5>
                   <div className="flex flex-wrap gap-2">
                     {uploadedImages.map((img, i) => {
                       if (!img) return null;
                       const sem = getSemanticName(i);
                       return <button key={i} onClick={() => insertMention(sem.tag)} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full transition-all"><img src={img} className="w-5 h-5 rounded-full object-cover"/><span className="text-[9px] font-black text-slate-400">@{sem.tag}</span></button>
                     })}
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase">DNA Lock</label><div className="h-1 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-yellow-500" style={{ width: `${settings.faceFidelity * 100}%` }} /></div></div>
                  <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase">Temp</label><div className="h-1 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${(settings.temperature / 1.5) * 100}%` }} /></div></div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {editingImage && (
          <div className="fixed inset-0 z-[2000] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-4">
             <div className="w-full max-w-7xl h-[92vh] bg-[#05080f] border border-white/10 rounded-[4rem] flex overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in">
              <div className="flex-1 flex flex-col border-r border-white/5 bg-black/20">
                <div className="px-10 py-6 border-b border-white/5 flex items-center justify-between"><div className="flex items-center gap-4"><Scissors size={24} className="text-yellow-500" /><h3 className="text-xl font-black text-white uppercase italic">Refiner Pro</h3></div><button onClick={() => setEditingImage(null)} className="p-3 rounded-full text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button></div>
                <div className="flex-1 flex items-center justify-center p-12 overflow-hidden relative"><img src={editingImage} className="max-w-full max-h-[60vh] object-contain shadow-2xl transition-all" style={{ filter: `brightness(${editorBrightness}%) contrast(${editorExposure + (editorSharpness/4)}%) saturate(${editorSaturation}%)`, transform: `rotate(${editorRotation}deg) scaleX(${editorFlipH ? -1 : 1})`, clipPath: `inset(${cropT}% ${cropR}% ${cropB}% ${cropL}%)` }} /></div>
                <div className="p-10 bg-[#0d1324] border-t border-white/5">
                   <div className="flex items-center gap-6 mb-8 overflow-x-auto pb-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase shrink-0">Crop Presets</span>
                      {['1:1', '16:9', '9:16', '4:3', '2:3'].map(p => (
                        <button key={p} onClick={() => applyCropPreset(p)} className="px-4 py-2 bg-white/5 hover:bg-yellow-500/20 border border-white/10 rounded-xl text-[10px] font-black uppercase text-slate-300 transition-all">{p}</button>
                      ))}
                   </div>
                   <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                     {[{ dir: 'Top', val: cropT, set: setCropT }, { dir: 'Bottom', val: cropB, set: setCropB }, { dir: 'Left', val: cropL, set: setCropL }, { dir: 'Right', val: cropR, set: setCropR }].map((c) => (
                       <div key={c.dir} className="space-y-3">
                         <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-500 uppercase">{c.dir}</span><span className="text-[10px] font-black text-yellow-500">{c.val}%</span></div>
                         <input type="range" min="0" max="80" value={c.val} onChange={e => c.set(parseInt(e.target.value))} className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-yellow-500" />
                       </div>
                     ))}
                   </div>
                </div>
              </div>
              <div className="w-[400px] bg-[#0a0f1d] p-10 flex flex-col gap-8">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Orient</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setEditorRotation(r => (r + 90) % 360)} className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-3xl hover:bg-white/10 border border-white/5 transition-all"><RotateCw size={20} /><span className="text-[8px] font-black uppercase">Rotate</span></button>
                      <button onClick={() => setEditorFlipH(!editorFlipH)} className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-3xl hover:bg-white/10 border border-white/5 transition-all"><Move size={20} /><span className="text-[8px] font-black uppercase">Flip</span></button>
                    </div>
                 </div>
                 <div className="space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                   {[{ label: 'Brightness', val: editorBrightness, set: setEditorBrightness }, { label: 'Saturation', val: editorSaturation, set: setEditorSaturation }, { label: 'Sharpness', val: editorSharpness, set: setEditorSharpness, min: 0, max: 100 }].map(ctrl => (
                     <div key={ctrl.label} className="space-y-3">
                       <div className="flex justify-between"><span className="text-[10px] font-black text-slate-400 uppercase">{ctrl.label}</span><span className="text-[10px] text-white font-black">{ctrl.val}%</span></div>
                       <input type="range" min={ctrl.min ?? 50} max={ctrl.max ?? 150} value={ctrl.val} onChange={e => ctrl.set(parseInt(e.target.value))} className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-yellow-500" />
                     </div>
                   ))}
                   <div className="pt-4 flex items-center justify-between border-t border-white/5">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={14}/> Add Noise</label>
                     <button onClick={() => setEditorAddNoise(!editorAddNoise)} className={`w-10 h-5 rounded-full transition-all relative ${editorAddNoise ? 'bg-yellow-500' : 'bg-white/10'}`}><div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${editorAddNoise ? 'left-6' : 'left-1'}`} /></button>
                   </div>
                 </div>
                 <button onClick={() => finalizeEditing('save')} className="w-full py-6 bg-yellow-500 text-black font-black rounded-3xl uppercase tracking-widest text-[11px] shadow-2xl transition-all hover:scale-[1.02] active:scale-95">Lock Selection</button>
              </div>
            </div>
          </div>
        )}

      {showSeedCreationModal && <SeedPromptModal onConfirm={handleSeedConfirm} onCancel={() => setShowSeedCreationModal(false)} />}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => { const r = new FileReader(); r.onload = () => openEditor(r.result as string, uploadSlotIdx!); if (e.target.files?.[0]) r.readAsDataURL(e.target.files[0]); e.target.value = ''; }} />
      <input type="file" ref={batchAssetsInputRef} className="hidden" accept="image/*" multiple onChange={handleBatchFileChange} />
      <canvas ref={editorCanvasRef} className="hidden" />
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        input[type=range] { -webkit-appearance: none; background: rgba(255,255,255,0.05); border-radius: 10px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: currentColor; cursor: pointer; border: 3px solid #05080f; }
      `}} />
    </div>
  );
};

export default EditorWorkspace;
