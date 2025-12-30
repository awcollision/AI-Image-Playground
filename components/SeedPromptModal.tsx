
import React, { useRef, useState, useEffect } from 'react';
import { X, Upload, Sparkles, ShieldCheck, Tag as TagIcon, UserCircle, Plus, ChevronRight, ChevronLeft } from 'lucide-react';

interface Props {
  onConfirm: (data: string, name: string, tags: string[]) => void;
  onBatchConfirm?: (seeds: { data: string, name: string, tags: string[] }[]) => void;
  onCancel: () => void;
  initialFiles?: File[];
}

interface SeedDraft {
  id: number;
  data: string;
  name: string;
  tags: string;
}

const SeedPromptModal: React.FC<Props> = ({ onConfirm, onBatchConfirm, onCancel, initialFiles }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  
  // Single mode state
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Batch mode state
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [seedDrafts, setSeedDrafts] = useState<SeedDraft[]>([]);
  const [currentDraftIndex, setCurrentDraftIndex] = useState(0);

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFiles(initialFiles);
    }
  }, [initialFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  };

  const handleFiles = (files: File[]) => {
    if (files.length > 1) {
      // Initialize Batch Mode
      setIsBatchMode(true);
      const newDrafts: SeedDraft[] = [];
      let processed = 0;

      files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newDrafts.push({
            id: index,
            data: reader.result as string,
            name: `Identity ${index + 1}`,
            tags: ''
          });
          processed++;
          if (processed === files.length) {
            setSeedDrafts(newDrafts.sort((a, b) => a.id - b.id));
          }
        };
        reader.readAsDataURL(file);
      });
    } else {
      // Single Mode
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = () => {
    if (isBatchMode && onBatchConfirm) {
      const finalSeeds = seedDrafts.map(draft => ({
        data: draft.data,
        name: draft.name,
        tags: draft.tags.split(',').map(t => t.trim()).filter(t => t !== '')
      }));
      onBatchConfirm(finalSeeds);
    } else if (selectedImage) {
      const tagList = tags.split(',').map(t => t.trim()).filter(t => t !== '');
      onConfirm(selectedImage, name || 'Unnamed Avatar', tagList);
    }
  };

  const updateDraft = (field: 'name' | 'tags', value: string) => {
    setSeedDrafts(prev => prev.map((d, i) => i === currentDraftIndex ? { ...d, [field]: value } : d));
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-[#05080f]/95 backdrop-blur-xl">
      <div className={`relative w-full ${isBatchMode ? 'max-w-4xl' : 'max-w-xl'} bg-[#0a0f1d] border border-white/10 rounded-[2.5rem] shadow-2xl p-8 overflow-hidden transition-all duration-500`}>
        <button 
          onClick={onCancel}
          className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-full transition z-10"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
            <Sparkles size={32} />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Identity Locker {isBatchMode && "(Batch)"}</h2>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              Lock in facial features and style into a permanent Seed ID for 100% consistent results.
            </p>
          </div>

          <div className="w-full space-y-4">
            
            {/* --- BATCH MODE UI --- */}
            {isBatchMode && seedDrafts.length > 0 ? (
              <div className="w-full">
                {/* Carousel / Side-by-Side View */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                   {/* Visual Preview */}
                   <div className="relative aspect-square rounded-2xl bg-slate-800/20 border border-white/10 overflow-hidden group">
                      <img src={seedDrafts[currentDraftIndex].data} className="w-full h-full object-contain" />
                      {seedDrafts.length > 1 && (
                         <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
                            {seedDrafts.map((_, i) => (
                              <button 
                                key={i} 
                                onClick={() => setCurrentDraftIndex(i)} 
                                className={`w-2 h-2 rounded-full transition-all ${i === currentDraftIndex ? 'bg-yellow-500 w-6' : 'bg-white/30'}`} 
                              />
                            ))}
                         </div>
                      )}
                      {currentDraftIndex > 0 && (
                        <button onClick={() => setCurrentDraftIndex(p => p - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"><ChevronLeft size={20}/></button>
                      )}
                      {currentDraftIndex < seedDrafts.length - 1 && (
                        <button onClick={() => setCurrentDraftIndex(p => p + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"><ChevronRight size={20}/></button>
                      )}
                   </div>

                   {/* Editor Inputs */}
                   <div className="flex flex-col gap-4 text-left p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                         <span className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">Editing {currentDraftIndex + 1} of {seedDrafts.length}</span>
                         <span className="text-[10px] text-slate-500">Seed #{seedDrafts[currentDraftIndex].id + 1}</span>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2 tracking-widest">
                          <UserCircle size={10} /> Identity Name
                        </label>
                        <input 
                          type="text" 
                          value={seedDrafts[currentDraftIndex].name}
                          onChange={(e) => updateDraft('name', e.target.value)}
                          className="w-full bg-slate-800/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-500/50 transition-colors placeholder:text-slate-700"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2 tracking-widest">
                          <TagIcon size={10} /> Context Tags
                        </label>
                        <input 
                          type="text" 
                          value={seedDrafts[currentDraftIndex].tags}
                          onChange={(e) => updateDraft('tags', e.target.value)}
                          placeholder="e.g. professional, glasses"
                          className="w-full bg-slate-800/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-500/50 transition-colors placeholder:text-slate-700"
                        />
                      </div>
                   </div>
                </div>
              </div>
            ) : (
              // --- SINGLE MODE UI ---
              <>
                {/* Adaptive Image Preview Area */}
                <div 
                  onClick={() => fileRef.current?.click()}
                  className={`relative w-full rounded-2xl bg-slate-800/20 border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:border-yellow-500/50 transition-all overflow-hidden group min-h-[160px] max-h-[400px]`}
                >
                  {selectedImage ? (
                    <div className="w-full h-full flex items-center justify-center p-1">
                      <img 
                        src={selectedImage} 
                        className="max-w-full max-h-[380px] object-contain rounded-xl shadow-2xl" 
                        alt="Seed preview"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-white text-xs font-bold uppercase bg-black/60 px-4 py-2 rounded-full">Change Portrait</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-600 group-hover:text-yellow-500 transition-colors">
                      <Upload size={32} />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Upload Master Reference</span>
                    </div>
                  )}
                </div>

                {/* Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="text-left space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2 tracking-widest">
                      <UserCircle size={10} /> Identity Name
                    </label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Pari Mishra"
                      className="w-full bg-slate-800/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-500/50 transition-colors placeholder:text-slate-700"
                    />
                  </div>
                  <div className="text-left space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2 tracking-widest">
                      <TagIcon size={10} /> Context Tags
                    </label>
                    <input 
                      type="text" 
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="e.g. high-fashion, portrait"
                      className="w-full bg-slate-800/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-500/50 transition-colors placeholder:text-slate-700"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="pt-4 space-y-3">
              <button 
                disabled={!selectedImage && seedDrafts.length === 0}
                onClick={handleCreate}
                className="group flex items-center justify-center gap-3 w-full py-5 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-30 text-[#05080f] font-black rounded-2xl transition-all shadow-xl shadow-yellow-500/10 uppercase text-xs tracking-widest"
              >
                {isBatchMode ? `Create ${seedDrafts.length} Identity Seeds` : 'Create Identity Seed'}
              </button>
              <button 
                onClick={onCancel}
                className="w-full py-2 text-slate-600 hover:text-slate-400 font-bold transition text-[10px] uppercase tracking-[0.3em]"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[8px] text-slate-700 font-bold tracking-[0.3em] uppercase pt-6 border-t border-white/5 w-full justify-center">
            <ShieldCheck size={14} className="text-slate-700" />
            Biometric Latent Encoding
          </div>
        </div>

        <input 
          type="file" 
          ref={fileRef} 
          className="hidden" 
          accept="image/*" 
          multiple
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};

export default SeedPromptModal;
