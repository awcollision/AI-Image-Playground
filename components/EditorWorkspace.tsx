
import React, { useState, useEffect, useRef } from 'react';
import { AppMode, GenSettings, AvatarSeed, ValidAspectRatio, ValidImageSize, GalleryItem } from '../types.ts';
import { 
  Wand2, Loader2, Image as ImageIcon, Plus, 
  Hash, Sparkles, ChevronLeft, AtSign,
  Zap, Maximize2, MoreVertical, Trash2, 
  Check, Scissors, Camera, FileUp, Ban, BrainCircuit, RotateCw, Download, X,
  Thermometer, ShieldCheck, Layers, Layout, Monitor, Undo2, Redo2, History, Target,
  RefreshCcw, Edit3, Minimize2, Move, Crop, Frame, Film, Fingerprint, UserCircle, Palette, Sliders, MonitorPlay, Sun, Contrast, UploadCloud, Users, User, Paintbrush
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
  const [uploadedImages, setUploadedImages] = useState<string[]>(new Array(18).fill(''));
  const [isPromptFullscreen, setIsPromptFullscreen] = useState(false);
  const [activeSourceMenuIdx, setActiveSourceMenuIdx] = useState<number | null>(null);
  const [uploadSlotIdx, setUploadSlotIdx] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editorRotation, setEditorRotation] = useState(0);
  const [editorFlipH, setEditorFlipH] = useState(false);
  const [editorBrightness, setEditorBrightness] = useState(100);
  const [editorContrast, setEditorContrast] = useState(100);
  
  const [isCropActive, setIsCropActive] = useState(false);
  const [cropMargins, setCropMargins] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [showSeedCreationModal, setShowSeedCreationModal] = useState(false);
  const [batchSeedFiles, setBatchSeedFiles] = useState<File[]>([]);

  // Mention State
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');

  const progressTimerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fullscreenTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editorCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const styleBatchInputRef = useRef<HTMLInputElement>(null);
  const promptCommitTimer = useRef<number | null>(null);

  // Handle auto-fill image from App.tsx (e.g. from the seed creation modal)
  useEffect(() => {
    if (autoFillImage && onAutoFillConsumed) {
      setUploadedImages(prev => {
        const next = [...prev];
        // For Group Photo, auto-fill into Slot 0 (Identity 1)
        next[0] = autoFillImage; 
        return next;
      });
      onAutoFillConsumed();
    }
  }, [autoFillImage, onAutoFillConsumed]);

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

  // Click outside listener to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeSourceMenuIdx !== null) {
        const target = event.target as HTMLElement;
        if (!target.closest('.group\\/source-container')) {
          setActiveSourceMenuIdx(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeSourceMenuIdx]);

  const openEditor = (dataUrl: string, idx: number) => {
    setEditingImage(dataUrl);
    setUploadSlotIdx(idx);
    setEditorRotation(0);
    setEditorFlipH(false);
    setEditorBrightness(100);
    setEditorContrast(100);
    setCropMargins({ top: 0, bottom: 0, left: 0, right: 0 });
    setIsCropActive(false);
    setActiveSourceMenuIdx(null);
  };

  const handleUploadTrigger = (idx: number) => {
    setUploadSlotIdx(idx);
    setActiveSourceMenuIdx(null);
    
    // For Identity Slots (0-2) in Group Photo mode, use Seed Modal workflow
    if (mode === AppMode.GROUP_PHOTO && idx < 3) {
      setShowSeedCreationModal(true);
      return;
    }

    // Default file picker for others
    setTimeout(() => {
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Reset so same file can be selected
            fileInputRef.current.click();
        }
    }, 0);
  };

  const handleSeedModalConfirm = (data: string, name: string, tags: string[]) => {
    // 1. Save globally if handler exists
    if (onAddSeed) onAddSeed(data, name, tags);
    
    // 2. Populate the specific slot
    if (uploadSlotIdx !== null) {
      setUploadedImages(prev => {
        const next = [...prev];
        next[uploadSlotIdx!] = data;
        return next;
      });
    }
    setShowSeedCreationModal(false);
    setUploadSlotIdx(null);
  };

  const handleBatchSeedConfirm = (newSeeds: { data: string, name: string, tags: string[] }[]) => {
    const newImages = [...uploadedImages];
    let startSlot = 0; // Identity slots start at 0
    
    newSeeds.forEach((s, i) => {
       // Save globally
       if (onAddSeed) onAddSeed(s.data, s.name, s.tags);
       // Populate slot if empty or filling sequentially
       const targetSlot = startSlot + i;
       if (targetSlot < 3) {
         newImages[targetSlot] = s.data;
       }
    });
    setUploadedImages(newImages);
    setShowSeedCreationModal(false);
    setBatchSeedFiles([]);
  };

  const finalizeEditing = () => {
    if (!editorCanvasRef.current || !editingImage || uploadSlotIdx === null) return;
    const canvas = editorCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const is90 = editorRotation % 180 !== 0;
      const fullWidth = is90 ? img.height : img.width;
      const fullHeight = is90 ? img.width : img.height;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = fullWidth;
      tempCanvas.height = fullHeight;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.save();
      tempCtx.filter = `brightness(${editorBrightness}%) contrast(${editorContrast}%)`;
      tempCtx.translate(fullWidth / 2, fullHeight / 2);
      tempCtx.rotate((editorRotation * Math.PI) / 180);
      if (editorFlipH) tempCtx.scale(-1, 1);
      tempCtx.drawImage(img, -img.width / 2, -img.height / 2);
      tempCtx.restore();
      const cropX = (cropMargins.left / 100) * fullWidth;
      const cropY = (cropMargins.top / 100) * fullHeight;
      const cropW = fullWidth - ((cropMargins.left + cropMargins.right) / 100) * fullWidth;
      const cropH = fullHeight - ((cropMargins.top + cropMargins.bottom) / 100) * fullHeight;
      canvas.width = Math.max(1, cropW);
      canvas.height = Math.max(1, cropH);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
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

  const handleMagicClick = async () => {
    // ALLOW empty prompt if neuralMemory is active or images are uploaded
    if (!prompt.trim() && !neuralMemory && uploadedImages.filter(Boolean).length === 0) return;
    
    let finalImages: string[] = [];
    let processedPrompt = prompt;
    
    if (mode === AppMode.GROUP_PHOTO) {
      // Logic for Group Photo: Slots 0-2 (Identity), Slots 3-11 (Source)
      for (let i = 0; i < uploadedImages.length; i++) {
        if (!uploadedImages[i]) continue;
        
        // Identity mapping
        if (i < 3) {
          const tag = `@identity${i + 1}`;
          if (processedPrompt.includes(tag)) {
            processedPrompt = processedPrompt.replace(new RegExp(tag, 'g'), `[PRIMARY_IDENTITY_${i + 1}]`);
            finalImages.push(uploadedImages[i]);
          }
        } 
        // Source mapping
        else if (i >= 3 && i < 12) {
           const tag = `@source${i - 2}`; // @source1 starts at index 3
           if (processedPrompt.includes(tag)) {
             processedPrompt = processedPrompt.replace(new RegExp(tag, 'g'), `[ASSET_SOURCE_${i - 2}]`);
             finalImages.push(uploadedImages[i]);
           }
        }
      }
    } else {
      // Logic for Portrait Mode
      for (let i = 0; i < uploadedImages.length; i++) {
        const tag = i < 12 ? `@image${i+1}` : `@style${i-11}`;
        if (processedPrompt.includes(tag) && uploadedImages[i]) {
          processedPrompt = processedPrompt.replace(new RegExp(tag, 'g'), i < 12 ? `[FACE_RECONSTRUCTION_${i+1}]` : `[STYLE_AESTHETIC_${i-11}]`);
          finalImages.push(uploadedImages[i]);
        }
      }
    }

    uploadedImages.forEach((img) => { if (img && !finalImages.includes(img)) finalImages.push(img); });
    
    // Process Saved Seeds Mentions
    seeds.forEach(s => {
      const seedTag = `@${s.name.replace(/\s+/g, '')}`;
      if (processedPrompt.includes(seedTag) && s.imageData) {
         processedPrompt = processedPrompt.replace(new RegExp(seedTag, 'g'), `[IDENTITY_SEED_${s.id}]`);
         if (!finalImages.includes(s.imageData)) finalImages.push(s.imageData);
      }
    });
    
    let finalRatio: string = settings.aspectRatio;
    if (finalRatio === "Original" && uploadedImages.find(i => i)) finalRatio = await detectAspectRatio(uploadedImages.find(i => i)!);
    else if (finalRatio === "Original") finalRatio = "1:1";
    onGenerate(processedPrompt, finalImages, finalRatio);
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

  const isGenerateDisabled = isLoading || (!prompt.trim() && !neuralMemory && uploadedImages.filter(Boolean).length === 0);
  const aspectRatios: (ValidAspectRatio | "Original")[] = ["Original", "1:1", "4:3", "3:4", "16:9", "9:16"];

  // DYNAMIC SLOTS BASED ON MODE
  const primarySlots = mode === AppMode.GROUP_PHOTO 
    ? uploadedImages.slice(0, 3).map((img, i) => ({ idx: i, tag: `identity${i+1}`, data: img, label: `Identity ${i+1}` })) 
    : uploadedImages.slice(0, 12).map((img, i) => ({ idx: i, tag: `image${i+1}`, data: img, label: `Face ${i+1}` }));
    
  const secondarySlots = mode === AppMode.GROUP_PHOTO 
    ? uploadedImages.slice(3, 12).map((img, i) => ({ idx: i + 3, tag: `source${i+1}`, data: img, label: `Source ${i+1}` }))
    : uploadedImages.slice(12, 18).map((img, i) => ({ idx: i + 12, tag: `style${i+1}`, data: img, label: `Style ${i+1}` }));

  // FILTER LOGIC FOR DEDUPLICATION
  // If a primary slot's image matches a Saved Seed, exclude it from the "Identity X" mention list
  // because it will appear as the "Saved Seed" name instead.
  const activePrimaryMentions = primarySlots.filter(m => {
     if (!m.data || !m.tag.includes(mentionFilter)) return false;
     // Check for duplicate in seeds
     const isSaved = seeds.some(s => s.imageData === m.data);
     return !isSaved; 
  });

  const activeSecondaryMentions = secondarySlots.filter(m => m.data && m.tag.includes(mentionFilter));
  
  const activeSeedMentions = seeds.map((s) => ({
    id: s.id,
    tag: s.name.replace(/\s+/g, ''),
    data: s.imageData,
    name: s.name
  })).filter(m => m.tag.toLowerCase().includes(mentionFilter));

  const handleSmartBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>, startIdx: number, count: number) => {
    const files = e.target.files;
    if (!files) return;
    const fileArray = Array.from(files);
    
    // Special handling for Identity Slots (startIdx === 0 in Group Photo)
    if (mode === AppMode.GROUP_PHOTO && startIdx === 0) {
      setBatchSeedFiles(fileArray);
      setShowSeedCreationModal(true);
      e.target.value = '';
      return;
    }

    const newImages = [...uploadedImages];
    let currentFileIndex = 0;
    
    // Fill empty slots first for non-identity/non-modal batches
    for (let i = startIdx; i < startIdx + count; i++) {
      if (!newImages[i] && currentFileIndex < fileArray.length) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(fileArray[currentFileIndex] as Blob);
        });
        newImages[i] = dataUrl;
        currentFileIndex++;
      }
    }
    
    setUploadedImages(newImages);
    e.target.value = '';
  };

  const MentionList = () => (
    <div className={`absolute ${isPromptFullscreen ? 'top-0 right-full mr-4 w-72' : 'bottom-full left-0 w-full mb-4'} bg-[#0d1324] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden z-[9999] animate-in ${isPromptFullscreen ? 'slide-in-from-right-4' : 'slide-in-from-bottom-4'}`}>
       <div className="px-5 py-3 border-b border-white/5 bg-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><AtSign size={10} /> Select Reference</div>
       <div className="max-h-64 overflow-y-auto custom-scrollbar">
         {/* SEEDS - Prioritized */}
         {activeSeedMentions.map((m) => (
           <button key={m.tag} onClick={() => insertMention(m.tag)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-yellow-500/10 text-left border-b border-white/5 transition-colors group/mention">
             <div className="w-10 h-10 rounded-xl overflow-hidden border border-yellow-500/20 group-hover/mention:border-yellow-500 transition-all shadow-lg">
               <img src={m.data} className="w-full h-full object-cover" />
             </div>
             <div className="flex flex-col">
               <span className="text-[11px] font-black text-white uppercase tracking-widest">@{m.tag}</span>
               <span className="text-[7px] font-black text-yellow-500 uppercase italic">Saved Identity</span>
             </div>
           </button>
         ))}

         {/* PRIMARY SLOTS (Only those NOT saved as seeds) */}
         {activePrimaryMentions.map((m) => (
           <button key={m.tag} onClick={() => insertMention(m.tag)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-700/30 text-left border-b border-white/5 transition-colors group/mention">
             <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 group-hover/mention:border-slate-400 transition-all shadow-lg">
               <img src={m.data} className="w-full h-full object-cover" />
             </div>
             <div className="flex flex-col">
               <span className="text-[11px] font-black text-white uppercase tracking-widest">@{m.tag}</span>
               <span className="text-[7px] font-black text-slate-500 uppercase italic">{m.label}</span>
             </div>
           </button>
         ))}
         
         {/* SECONDARY SLOTS */}
         {activeSecondaryMentions.map((m) => (
           <button key={m.tag} onClick={() => insertMention(m.tag)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-emerald-500/10 text-left border-b border-white/5 transition-colors group/mention">
             <div className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-500/30 group-hover/mention:border-emerald-500 transition-all shadow-lg">
               <img src={m.data} className="w-full h-full object-cover" />
             </div>
             <div className="flex flex-col">
               <span className="text-[11px] font-black text-white uppercase tracking-widest">@{m.tag}</span>
               <span className="text-[7px] font-black text-emerald-500 uppercase italic">{m.label}</span>
             </div>
           </button>
         ))}
         
         {activePrimaryMentions.length === 0 && activeSecondaryMentions.length === 0 && activeSeedMentions.length === 0 && (
           <div className="px-5 py-8 text-center text-[10px] text-slate-700 font-black uppercase tracking-widest italic">No active references found</div>
         )}
       </div>
    </div>
  );

  return (
    // Use absolute positioning to ensure it takes exactly the available space from the parent 'relative' container
    <div className="absolute inset-0 flex font-sans bg-[#020408] overflow-hidden">
      {/* Top Visual Progress Bar */}
      <div className={`absolute top-0 left-0 w-full h-1 z-[200] transition-opacity duration-300 ${progress > 0 ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-full bg-yellow-500 shadow-[0_0_15px_#eab308] transition-all duration-300 ease-linear" style={{ width: `${progress}%` }} />
      </div>

      {/* Sidebar: Fixed width, full height, flex column for strict layout control */}
      <aside className="w-[420px] bg-[#05080f] border-r border-white/5 flex flex-col h-full shrink-0 z-20 relative shadow-2xl">
        
        {/* Scrollable Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain">
          <div className="p-8 space-y-12 pb-12">
            
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={onBackToHome} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-[11px] font-black uppercase tracking-widest border border-white/5">
                  <ChevronLeft size={16} /> Back
                </button>
                <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/5">
                   <button disabled={!canUndo} onClick={onUndo} className="p-2 text-slate-400 hover:text-white disabled:opacity-20 transition-all hover:bg-white/5 rounded-lg"><Undo2 size={16} /></button>
                   <button disabled={!canRedo} onClick={onRedo} className="p-2 text-slate-400 hover:text-white disabled:opacity-20 transition-all hover:bg-white/5 rounded-lg"><Redo2 size={16} /></button>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black tracking-[0.3em] text-yellow-500 uppercase mb-0.5">Anatomical Synthesis</div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight italic">
                  {mode === AppMode.GROUP_PHOTO ? "Group Composition" : "Portrait Generator"}
                </h3>
              </div>
            </div>

            {/* SECTION 1: PRIMARY INPUTS (Identities or Face Refs) */}
            <div className="space-y-4 shrink-0">
               <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]">
                    {mode === AppMode.GROUP_PHOTO ? (
                      <><User size={14} className="text-yellow-500" /> Identity Seeds</>
                    ) : (
                      <><Fingerprint size={14} className="text-yellow-500" /> Reference Composition</>
                    )}
                  </label>
                  <button onClick={() => batchInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/5 hover:bg-yellow-500/10 rounded-full border border-yellow-500/20 text-yellow-500 text-[9px] font-black uppercase tracking-widest transition-all">
                    <UploadCloud size={14} /> Batch Upload
                  </button>
               </div>
               
               <div className={`grid gap-4 ${mode === AppMode.GROUP_PHOTO ? 'grid-cols-3' : 'grid-cols-3'}`}>
                  {primarySlots.map((slot) => (
                    <div key={slot.idx} className="relative group/source-container">
                      <button onClick={() => uploadedImages[slot.idx] ? openEditor(uploadedImages[slot.idx], slot.idx) : handleUploadTrigger(slot.idx)} className={`aspect-square w-full bg-slate-800/10 border border-white/5 rounded-[1.5rem] flex items-center justify-center hover:border-yellow-500/30 transition-all overflow-hidden relative`}>
                        {uploadedImages[slot.idx] ? (
                          <><img src={uploadedImages[slot.idx]} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover/source:opacity-100 flex items-center justify-center transition-opacity"><Scissors size={20} className="text-white" /></div></>
                        ) : (
                          <div className="flex flex-col items-center gap-1 opacity-20 group-hover/source:opacity-100 transition-opacity">
                            <UserCircle size={18} />
                            <span className="text-[7px] font-black uppercase tracking-tighter">{slot.label}</span>
                          </div>
                        )}
                      </button>
                      {uploadedImages[slot.idx] && (
                        <div className="absolute top-2 right-2 z-20">
                          <button onClick={(e) => { e.stopPropagation(); setActiveSourceMenuIdx(activeSourceMenuIdx === slot.idx ? null : slot.idx); }} className="bg-[#05080f]/80 backdrop-blur-md p-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all opacity-0 group-hover/source-container:opacity-100">
                            <MoreVertical size={14} />
                          </button>
                          {activeSourceMenuIdx === slot.idx && (
                            <div className="absolute top-full right-0 mt-2 w-32 bg-[#111827] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in fade-in zoom-in-95">
                               <button onClick={() => openEditor(uploadedImages[slot.idx], slot.idx)} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 text-slate-400 hover:text-white transition-colors text-[9px] font-black uppercase tracking-widest border-b border-white/5"><Edit3 size={12} /> Edit</button>
                               <button onClick={() => handleUploadTrigger(slot.idx)} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 text-slate-400 hover:text-white transition-colors text-[9px] font-black uppercase tracking-widest border-b border-white/5"><RefreshCcw size={12} /> Replace</button>
                               <button onClick={() => { setUploadedImages(prev => { const n = [...prev]; n[slot.idx] = ''; return n; }); setActiveSourceMenuIdx(null); }} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-red-500/10 text-red-500 transition-colors text-[9px] font-black uppercase tracking-widest"><Trash2 size={12} /> Clear</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
               </div>
            </div>

            {/* SECTION 2: SECONDARY INPUTS (Sources or Styles) */}
            <div className="space-y-4 shrink-0">
               <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-500 flex items-center gap-2 uppercase tracking-[0.2em]">
                    {mode === AppMode.GROUP_PHOTO ? (
                      <><Layers size={14} className="text-emerald-500" /> Image Sources</>
                    ) : (
                      <><Palette size={14} className="text-emerald-500" /> Style References</>
                    )}
                  </label>
                  <button onClick={() => styleBatchInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-widest transition-all">
                    <UploadCloud size={14} /> Batch Upload
                  </button>
               </div>
               
               <div className={`grid gap-4 ${mode === AppMode.GROUP_PHOTO ? 'grid-cols-3' : 'grid-cols-3'}`}>
                  {secondarySlots.map((slot) => {
                    return (
                      <div key={slot.idx} className="relative group/source-container">
                        <button onClick={() => uploadedImages[slot.idx] ? openEditor(uploadedImages[slot.idx], slot.idx) : handleUploadTrigger(slot.idx)} className={`aspect-square w-full bg-emerald-500/5 border border-emerald-500/10 rounded-[1.5rem] flex items-center justify-center hover:border-emerald-500/40 transition-all overflow-hidden relative`}>
                          {uploadedImages[slot.idx] ? (
                            <><img src={uploadedImages[slot.idx]} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover/source:opacity-100 flex items-center justify-center transition-opacity"><Scissors size={20} className="text-white" /></div></>
                          ) : (
                            <div className="flex flex-col items-center gap-1 opacity-40 group-hover/source:opacity-100 transition-opacity">
                              <Zap size={18} className="text-emerald-500" />
                              <span className="text-[7px] font-black uppercase tracking-tighter text-emerald-500">{slot.label}</span>
                            </div>
                          )}
                        </button>
                        {uploadedImages[slot.idx] && (
                          <div className="absolute top-2 right-2 z-20">
                            <button onClick={(e) => { e.stopPropagation(); setActiveSourceMenuIdx(activeSourceMenuIdx === slot.idx ? null : slot.idx); }} className="bg-[#05080f]/80 backdrop-blur-md p-1.5 rounded-xl border border-white/10 text-emerald-400 hover:text-white transition-all opacity-0 group-hover/source-container:opacity-100">
                              <MoreVertical size={14} />
                            </button>
                            {activeSourceMenuIdx === slot.idx && (
                              <div className="absolute top-full right-0 mt-2 w-32 bg-[#111827] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in fade-in zoom-in-95">
                                 <button onClick={() => openEditor(uploadedImages[slot.idx], slot.idx)} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 text-slate-400 hover:text-white transition-colors text-[9px] font-black uppercase tracking-widest border-b border-white/5"><Edit3 size={12} /> Edit</button>
                                 <button onClick={() => handleUploadTrigger(slot.idx)} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 text-slate-400 hover:text-white transition-colors text-[9px] font-black uppercase tracking-widest border-b border-white/5"><RefreshCcw size={12} /> Replace</button>
                                 <button onClick={() => { setUploadedImages(prev => { const n = [...prev]; n[slot.idx] = ''; return n; }); setActiveSourceMenuIdx(null); }} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-red-500/10 text-red-500 transition-colors text-[9px] font-black uppercase tracking-widest"><Trash2 size={12} /> Clear</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
               </div>
            </div>

            <div className="space-y-6 shrink-0 relative">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">Biometric Instructions</label>
                  <button onClick={() => setIsPromptFullscreen(true)} className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/5 rounded-lg text-yellow-500 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest">
                    <Maximize2 size={12} /> Expand
                  </button>
                </div>
                <div className="relative group/prompt overflow-visible rounded-[2.5rem]">
                  <textarea 
                    ref={textareaRef} 
                    value={prompt} 
                    onChange={handlePromptChange} 
                    onBlur={() => onCommitPrompt(prompt)} 
                    placeholder={mode === AppMode.GROUP_PHOTO 
                      ? "Describe the group shot. Use @identity1 for main subject, @source1 for background asset..." 
                      : "e.g. Combine faces of @image1-@image4. Narrow the bridge of the nose..."}
                    className="w-full h-40 bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-6 pr-14 text-sm text-slate-200 placeholder:text-slate-800 focus:outline-none focus:border-yellow-500/50 transition-all resize-none custom-scrollbar" 
                  />
                  {showMentions && !isPromptFullscreen && <MentionList />}
                </div>
              </div>
            </div>

            <div className="space-y-8 bg-yellow-500/5 p-6 rounded-[2.5rem] border border-yellow-500/10">
              <div className="flex items-center gap-3"><BrainCircuit size={18} className="text-yellow-500" /><span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Biometric Synthesis Core</span></div>
              <div className="space-y-8">
                
                {/* NEW STYLE PRESET DROPDOWN */}
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Paintbrush size={12} /> Output Style</label>
                  <select 
                    value={settings.stylePreset || "Cinematic (Default)"} 
                    onChange={(e) => onUpdateSettings({...settings, stylePreset: e.target.value})} 
                    className="w-full bg-[#0d1324] border border-white/5 rounded-xl px-4 py-3 text-[11px] font-bold text-white focus:outline-none focus:border-yellow-500/50 appearance-none cursor-pointer"
                  >
                    <option value="Cinematic (Default)">Cinematic (Default)</option>
                    <option value="Ghibli Art">Ghibli Art Style</option>
                    <option value="Anime">Anime (High Quality)</option>
                    <option value="Disney">Disney / Pixar 3D</option>
                    <option value="Semi-Realism">Semi-Realism (ArtStation)</option>
                    <option value="3D Art">3D Render (Octane)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Thermometer size={12} /> Neural Temp</label><span className="text-[10px] font-black text-yellow-500">{settings.temperature.toFixed(1)}</span></div>
                  <input type="range" min="0" max="1.5" step="0.1" value={settings.temperature} onChange={(e) => onUpdateSettings({...settings, temperature: parseFloat(e.target.value)})} className="w-full h-1 bg-[#0d1324] rounded-full appearance-none accent-yellow-500 cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Layout size={12} /> Aspect Ratio</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Original", "1:1", "4:3", "3:4", "16:9", "9:16"].map(ratio => (<button key={ratio} onClick={() => onUpdateSettings({...settings, aspectRatio: ratio as any})} className={`py-2 text-[10px] font-black rounded-lg transition-all border ${settings.aspectRatio === ratio ? 'bg-yellow-500 border-yellow-500 text-[#05080f] shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-[#0d1324] border-white/5 text-slate-500 hover:text-white hover:border-white/10'}`}>{ratio}</button>))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={12} /> Identity Fidelity</label><span className="text-[10px] font-black text-yellow-500">{Math.round(settings.faceFidelity * 100)}%</span></div>
                  <input type="range" min="0" max="1" step="0.05" value={settings.faceFidelity} onChange={(e) => onUpdateSettings({...settings, faceFidelity: parseFloat(e.target.value)})} className="w-full h-1 bg-[#0d1324] rounded-full appearance-none accent-yellow-500 cursor-pointer" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Sliders size={12} /> Prompt Strictness</label><span className="text-[10px] font-black text-yellow-500">{Math.round(settings.strictness * 100)}%</span></div>
                  <input type="range" min="0" max="1" step="0.05" value={settings.strictness} onChange={(e) => onUpdateSettings({...settings, strictness: parseFloat(e.target.value)})} className="w-full h-1 bg-[#0d1324] rounded-full appearance-none accent-yellow-500 cursor-pointer" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><Camera size={10} /> Angle</label>
                    <select value={settings.cameraAngle} onChange={(e) => onUpdateSettings({...settings, cameraAngle: e.target.value})} className="w-full bg-[#0d1324] border border-white/5 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-yellow-500/50">
                      {["Default", "Close-up", "Low Angle", "High Angle", "Profile", "Three-Quarter"].map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><MonitorPlay size={10} /> Pose</label>
                    <select value={settings.pose} onChange={(e) => onUpdateSettings({...settings, pose: e.target.value})} className="w-full bg-[#0d1324] border border-white/5 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-yellow-500/50">
                      {["Default", "Formal", "Standing", "Dynamic", "Relaxed"].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="p-8 bg-[#05080f] border-t border-white/5 z-30 shrink-0">
          <button disabled={isGenerateDisabled} onClick={handleMagicClick} className={`w-full py-8 font-black rounded-[3rem] shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.97] ${isGenerateDisabled ? 'bg-slate-800 text-slate-600' : 'bg-yellow-500 hover:bg-yellow-400 text-[#05080f]'}`}>
            {isLoading ? <Loader2 className="animate-spin" /> : <><Sparkles size={24} /> <span className="uppercase text-lg tracking-[0.1em]">{mode === AppMode.GROUP_PHOTO ? "Synthesize Group" : "Construct Portrait"}</span></>}
          </button>
        </div>
      </aside>

      {/* Main Preview Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-[#020408] relative overflow-hidden">
        
        {/* Upper Region: Preview/Idle - Flex 1 to take remaining space but min-h-0 to allow shrinking */}
        <div className="flex-1 min-h-0 w-full flex items-center justify-center p-6 md:p-10 relative">
          {(previewImage || isLoading) ? (
            <div className="relative flex flex-col items-center animate-in fade-in zoom-in duration-1000 group w-full h-full justify-center">
              <div className={`relative rounded-[4rem] overflow-hidden shadow-[0_60px_120px_rgba(0,0,0,1)] border border-white/5 bg-slate-900/50 transition-all ${!previewImage && isLoading ? 'w-full max-w-md aspect-[3/4] flex items-center justify-center' : ''} ${previewImage ? 'max-h-full max-w-full' : ''}`}>
                {previewImage && (
                  <img src={previewImage} className={`max-h-full max-w-full object-contain transition-all duration-700 ${isLoading ? 'opacity-40 blur-sm scale-95' : 'opacity-100 scale-100'}`} />
                )}
                
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-50">
                     <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 rounded-full border-4 border-white/5 border-t-yellow-500 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sparkles className="text-yellow-500 animate-pulse" size={32} />
                        </div>
                     </div>
                     <div className="flex flex-col items-center gap-2">
                       <span className="text-2xl font-black text-white">{Math.round(progress)}%</span>
                       <span className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.4em] animate-pulse">Synthesizing...</span>
                     </div>
                  </div>
                )}

                {previewImage && !isLoading && (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2.5 bg-[#0a0f1d]/90 backdrop-blur-3xl rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 border border-white/10 shadow-2xl z-40">
                     <button onClick={() => openEditor(previewImage, 0)} className="p-4 bg-white/5 hover:bg-white/10 rounded-3xl text-slate-300 hover:text-white transition-all flex flex-col items-center gap-1"><Edit3 size={20} /><span className="text-[8px] font-black uppercase tracking-tighter">Refine</span></button>
                     <button onClick={() => setIsFullscreenPreview(true)} className="p-4 bg-white/5 hover:bg-yellow-500 text-slate-300 hover:text-[#05080f] rounded-3xl transition-all flex flex-col items-center gap-1"><Maximize2 size={20} /><span className="text-[8px] font-black uppercase tracking-tighter">Full Screen</span></button>
                     <button onClick={() => {const l=document.createElement('a'); l.href=previewImage; l.download='portrait_master.png'; l.click();}} className="p-4 bg-white/5 hover:bg-white/10 rounded-3xl text-slate-300 hover:text-white transition-all flex flex-col items-center gap-1"><Download size={20} /><span className="text-[8px] font-black uppercase tracking-tighter">Save</span></button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-8 opacity-10">
               {mode === AppMode.GROUP_PHOTO ? <Users size={100} className="text-white" /> : <UserCircle size={100} className="text-white" />}
               <h4 className="text-3xl font-black text-white uppercase tracking-[0.4em]">Synthesis Pipeline Idle</h4>
            </div>
          )}
        </div>

        {/* Lower Region: Gallery Strip - Fixed Height */}
         <div className={`w-full h-28 shrink-0 flex items-center justify-center gap-3 overflow-x-auto scrollbar-hide py-2 px-10 mb-4 animate-in slide-in-from-bottom-6 fade-in duration-700 z-30 ${gallery.length === 0 ? 'opacity-30' : 'opacity-100'}`}>
           {gallery.length > 0 ? (
             gallery.slice(0, 8).map((item, idx) => (
               <button 
                 key={idx} 
                 onClick={() => onSelectFromGallery(item.url)}
                 className={`shrink-0 w-16 h-16 rounded-2xl overflow-hidden border-2 transition-all hover:scale-110 ${previewImage === item.url ? 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)] scale-110' : 'border-white/5 grayscale opacity-40 hover:opacity-100 hover:grayscale-0'}`}
               >
                 <img src={item.url} className="w-full h-full object-cover" />
               </button>
             ))
           ) : (
             // Placeholders for empty state
             [...Array(6)].map((_, i) => (
                <div key={i} className="shrink-0 w-16 h-16 rounded-2xl border-2 border-white/5 bg-white/5 flex items-center justify-center">
                  <span className="text-[8px] text-slate-700 font-black">{i+1}</span>
                </div>
             ))
           )}
         </div>
      </main>

      {editingImage && (
          <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in">
            <div className="w-full max-w-6xl h-[85vh] bg-[#05080f] border border-white/10 rounded-[4rem] flex flex-col overflow-hidden shadow-2xl">
              <div className="px-12 py-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4"><Scissors size={24} className="text-yellow-500" /><h3 className="text-xl font-black text-white uppercase italic tracking-tight">Refine Synthesis Rig</h3></div>
                <button onClick={() => {setEditingImage(null); setUploadSlotIdx(null);}} className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all"><X size={24} /></button>
              </div>
              <div className="flex-1 flex min-h-0">
                <div className="flex-1 bg-black/50 p-12 flex items-center justify-center overflow-hidden relative">
                  <div className="relative group/rig-preview shadow-2xl border border-white/10 rounded-lg overflow-hidden transition-transform duration-300" style={{ transform: `rotate(${editorRotation}deg) scaleX(${editorFlipH ? -1 : 1})` }}>
                    <img src={editingImage} className="max-w-full max-h-[60vh] object-contain block transition-all" style={{ filter: `brightness(${editorBrightness}%) contrast(${editorContrast}%)` }} />
                    <div className="absolute inset-0 pointer-events-none">
                      {['top', 'bottom', 'left', 'right'].map(m => (
                        <div key={m} className={`absolute ${m === 'top' || m === 'bottom' ? m + '-0 left-0 w-full' : m + '-0 h-full'} bg-black/80 transition-all duration-300`} style={{ [m === 'top' || m === 'bottom' ? 'height' : 'width']: `${cropMargins[m as keyof typeof cropMargins]}%` }} />
                      ))}
                    </div>
                  </div>
                  <canvas ref={editorCanvasRef} className="hidden" />
                </div>
                <div className="w-96 border-l border-white/5 p-10 flex flex-col gap-10 bg-slate-900/10 overflow-y-auto custom-scrollbar">
                  <div className="space-y-6">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><RotateCw size={14} /> Orientation</label>
                    <div className="flex gap-3"><button onClick={() => setEditorRotation(prev => (prev + 90) % 360)} className="flex-1 py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black text-slate-400 hover:text-white transition-all">Rotate</button><button onClick={() => setEditorFlipH(!editorFlipH)} className="flex-1 py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black text-slate-400 hover:text-white transition-all">Mirror H</button></div>
                  </div>
                  <div className="space-y-6 bg-white/5 p-6 rounded-[2rem] border border-white/10">
                    <div className="flex items-center justify-between"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Scissors size={14} className="text-yellow-500" /> Anatomical Crop</label><button onClick={() => setIsCropActive(!isCropActive)} className={`p-2 rounded-lg transition-all ${isCropActive ? 'bg-yellow-500 text-[#05080f]' : 'bg-white/5 text-slate-500 hover:text-white'}`}><Crop size={14} /></button></div>
                    <div className={`space-y-6 transition-all duration-500 ${isCropActive ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                      {['top', 'bottom', 'left', 'right'].map(m => (
                        <div key={m} className="space-y-4">
                          <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase tracking-widest"><span>{m} Cut</span><span className="text-yellow-500">{cropMargins[m as keyof typeof cropMargins]}%</span></div>
                          <input type="range" min="0" max="45" value={cropMargins[m as keyof typeof cropMargins]} onChange={(e) => setCropMargins(prev => ({ ...prev, [m]: parseInt(e.target.value) }))} className="w-full accent-yellow-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-8"><div className="space-y-4"><div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Sun size={14} /> Brightness <span className="text-white ml-auto">{editorBrightness}%</span></div><input type="range" min="50" max="150" value={editorBrightness} onChange={(e) => setEditorBrightness(parseInt(e.target.value))} className="w-full accent-yellow-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" /></div><div className="space-y-4"><div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Contrast size={14} /> Contrast <span className="text-white ml-auto">{editorContrast}%</span></div><input type="range" min="50" max="150" value={editorContrast} onChange={(e) => setEditorContrast(parseInt(e.target.value))} className="w-full accent-yellow-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" /></div></div>
                  <div className="mt-auto pt-10 border-t border-white/5"><button onClick={finalizeEditing} className="w-full py-6 bg-yellow-500 hover:bg-yellow-400 text-[#05080f] font-black rounded-3xl flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-sm shadow-xl shadow-yellow-500/10 active:scale-95"><Check size={20} /> Deploy Changes</button></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isPromptFullscreen && (
          <div className="fixed inset-0 z-[2000] bg-[#020408]/98 backdrop-blur-3xl flex items-center justify-center p-12 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-full max-w-5xl h-[80vh] flex flex-col relative">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4 text-white uppercase italic font-black"><BrainCircuit size={32} className="text-yellow-500" /><h2 className="text-2xl tracking-tighter">Expanded Synthesis Weaver</h2></div>
                <button onClick={() => setIsPromptFullscreen(false)} className="p-4 bg-white/5 hover:bg-red-500/20 text-slate-500 hover:text-red-500 rounded-full transition-all border border-white/5"><Minimize2 size={32} /></button>
              </div>
              <div className="flex-1 relative">
                <textarea ref={fullscreenTextareaRef} autoFocus value={prompt} onChange={handlePromptChange} onBlur={() => onCommitPrompt(prompt)} className="w-full h-full bg-[#0a0f1d] border border-white/10 rounded-[3rem] p-12 text-2xl text-slate-100 placeholder:text-slate-800 focus:outline-none focus:border-yellow-500/50 transition-all resize-none custom-scrollbar font-medium" placeholder="Describe the structural and stylistic reconstruction in detail..." />
                {showMentions && <MentionList />}
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen Image Preview Modal */}
        {isFullscreenPreview && previewImage && (
          <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in">
             <button onClick={() => setIsFullscreenPreview(false)} className="absolute top-6 right-6 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all z-50"><X size={24} /></button>
             <img src={previewImage} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" />
          </div>
        )}
      
      {/* SEED CREATION MODAL FOR IDENTITY SLOTS */}
      {showSeedCreationModal && (
        <SeedPromptModal 
           onConfirm={handleSeedModalConfirm} 
           onBatchConfirm={handleBatchSeedConfirm}
           onCancel={() => { setShowSeedCreationModal(false); setBatchSeedFiles([]); }} 
           initialFiles={batchSeedFiles}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { 
          width: 8px;
          display: block; 
        }
        .custom-scrollbar::-webkit-scrollbar-track { 
          background: rgba(0,0,0,0.1); 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
          background: rgba(255,255,255,0.1); 
          border-radius: 4px; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { 
          background: rgba(255,255,255,0.2); 
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file && uploadSlotIdx !== null) {
          const reader = new FileReader();
          reader.onloadend = () => { openEditor(reader.result as string, uploadSlotIdx!); };
          reader.readAsDataURL(file);
        }
        e.target.value = '';
      }} />

      <input type="file" ref={batchInputRef} className="hidden" multiple accept="image/*" onChange={(e) => handleSmartBatchUpload(e, 0, 12)} />
      <input type="file" ref={styleBatchInputRef} className="hidden" multiple accept="image/*" onChange={(e) => handleSmartBatchUpload(e, 12, 6)} />
    </div>
  );
};

export default EditorWorkspace;
