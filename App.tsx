import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppMode, AvatarSeed, UserState, GenSettings, GalleryItem } from './types.ts';
import { generateImage, refineNeuralWeights } from './services/geminiService.ts';
import LandingPage from './components/LandingPage.tsx';
import EditorWorkspace from './components/EditorWorkspace.tsx';
import SeedPromptModal from './components/SeedPromptModal.tsx';
import { Sparkles, BrainCircuit, Activity, X, Terminal, Database, Radio, Trash2 } from 'lucide-react';

interface HistoryState {
  prompt: string;
  settings: GenSettings;
  negativePrompt: string;
}

const App: React.FC = () => {
  const [state, setState] = useState<UserState>({
    seeds: [],
    currentMode: AppMode.LANDING,
    isKeySelected: false,
    settings: {
      temperature: 0.8, 
      variation: 0.5,
      faceFidelity: 0.95, 
      strictness: 0.8,
      aspectRatio: "Original",
      numberOfImages: 1,
      imageSize: "1K",
      cameraAngle: "Default",
      pose: "Default",
      enableFilmGrain: true,
      stylePreset: "Photorealistic"
    },
    negativePrompt: '',
    promptHistory: [],
    generatedGallery: [],
    neuralWeights: "PREFERENCE: Absolute photorealism. Lighting MUST match base image ISO/WB exactly. No plastic skin; enforce subsurface scattering and pore texture. Natural blur matching. Authentic, casual poses."
  });

  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoing = useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [pendingMode, setPendingMode] = useState<AppMode | null>(null);
  const [lastGeneratedImage, setLastGeneratedImage] = useState<string | null>(null);
  
  const [showMemoryLog, setShowMemoryLog] = useState(false);
  const [autoFillImage, setAutoFillImage] = useState<string | null>(null);

  useEffect(() => {
    // Safe access to window.aistudio to prevent runtime crashes
    const aiStudio = (window as any).aistudio;
    if (typeof window !== 'undefined' && aiStudio) {
      aiStudio.hasSelectedApiKey().then((hasKey: boolean) => {
         if (hasKey) setState(prev => ({ ...prev, isKeySelected: true }));
      }).catch(() => {
         // Ignore error if aistudio check fails
      });
    }
  }, []);

  const handleClearMemory = () => {
    setState(prev => ({ ...prev, neuralWeights: "Reset. Awaiting user feedback..." }));
    setShowMemoryLog(false);
  };

  const handleFeedback = async (type: 'like' | 'dislike', item: GalleryItem) => {
    setState(prev => ({
      ...prev,
      generatedGallery: prev.generatedGallery.map(g => g.timestamp === item.timestamp ? { ...g, feedback: type } : g)
    }));

    try {
       const newWeights = await refineNeuralWeights(state.neuralWeights, item.prompt, type);
       setState(prev => ({ ...prev, neuralWeights: newWeights }));
    } catch (e) {
       console.error("Neural Learning failed:", e);
    }
  };

  const pushToHistory = useCallback((p: string, s: GenSettings, np: string) => {
    if (isUndoRedoing.current) return;
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      const nextState = { prompt: p, settings: JSON.parse(JSON.stringify(s)), negativePrompt: np };
      const updated = [...newHistory, nextState].slice(-50);
      setHistoryIndex(updated.length - 1);
      return updated;
    });
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoing.current = true;
      const prevState = history[historyIndex - 1];
      setPrompt(prevState.prompt);
      setState(prev => ({ ...prev, settings: prevState.settings, negativePrompt: prevState.negativePrompt }));
      setHistoryIndex(historyIndex - 1);
      setTimeout(() => { isUndoRedoing.current = false; }, 50);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoing.current = true;
      const nextState = history[historyIndex + 1];
      setPrompt(nextState.prompt);
      setState(prev => ({ ...prev, settings: nextState.settings, negativePrompt: nextState.negativePrompt }));
      setHistoryIndex(historyIndex + 1);
      setTimeout(() => { isUndoRedoing.current = false; }, 50);
    }
  }, [history, historyIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.shiftKey ? handleRedo() : handleUndo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleOpenKeySelector = async () => {
    const aiStudio = (window as any).aistudio;
    if (typeof window !== 'undefined' && aiStudio) {
      await aiStudio.openSelectKey();
      setState(prev => ({ ...prev, isKeySelected: true }));
    }
  };

  const handleGenerate = async (finalPrompt: string, images: string[], determinedRatio?: string) => {
    const aiStudio = (window as any).aistudio;
    if (typeof window !== 'undefined' && aiStudio) {
      const hasKey = await aiStudio.hasSelectedApiKey();
      if (!hasKey) {
        await handleOpenKeySelector();
      }
    }

    setIsLoading(true);
    try {
      const response = await generateImage(finalPrompt, images, {
        temperature: state.settings.temperature,
        variation: state.settings.variation,
        faceFidelity: state.settings.faceFidelity,
        strictness: state.settings.strictness,
        aspectRatio: (determinedRatio || state.settings.aspectRatio) as any,
        imageSize: state.settings.imageSize as any,
        stylePreset: state.settings.stylePreset,
        memoryContext: state.neuralWeights
      });
      if (response.images?.length > 0) {
        const newImg = response.images[0];
        setLastGeneratedImage(newImg);
        const newItem: GalleryItem = { 
           url: newImg, 
           prompt: finalPrompt, 
           settings: state.settings, 
           timestamp: Date.now(),
           feedback: null 
        };
        setState(prev => ({ 
          ...prev, 
          promptHistory: [...prev.promptHistory, finalPrompt].slice(-30),
          generatedGallery: [newItem, ...prev.generatedGallery]
        }));
      } else {
        alert("Generation completed but no image was returned. Try adjusting strictness or prompt.");
      }
    } catch (error: any) { 
      if (error.message?.includes("API Key disconnected")) {
         await handleOpenKeySelector();
      } else {
         console.error(error);
         alert("Synthesis Error: " + error.message); 
      }
    }
    finally { setIsLoading(false); }
  };

  // Explicitly define editor modes to avoid loose matching
  const isEditorMode = [
    AppMode.PORTRAIT_GENERATOR, 
    AppMode.GROUP_PHOTO, 
    AppMode.ACCESSORIES_GENERATOR, 
    AppMode.THUMBNAIL_CREATOR
  ].includes(state.currentMode);

  return (
    <div className="flex flex-col h-screen bg-[#05080f] text-slate-100 overflow-hidden font-sans">
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-[#05080f]/80 backdrop-blur-xl z-50">
        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setState(prev => ({ ...prev, currentMode: AppMode.LANDING }))}>
          <div className="bg-yellow-500 p-2.5 rounded-2xl group-hover:rotate-12 transition-all shadow-[0_0_30px_rgba(234,179,8,0.3)] duration-500">
            <Sparkles size={22} className="text-[#05080f]" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter uppercase italic text-yellow-500">Astra <span className="text-white">AI</span></h1>
        </div>
        <div className="flex items-center gap-8">
          {isEditorMode && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-white/5">
               <Radio size={14} className="text-green-500 animate-pulse" />
               <span className="text-[9px] font-black uppercase tracking-widest text-slate-200">Active Learning</span>
            </div>
          )}
          {isEditorMode && (
            <button onClick={() => setShowMemoryLog(true)} className={`flex items-center gap-2 px-4 py-2 border rounded-full transition-all group ${state.neuralWeights.length > 30 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-white/5 border-white/10'}`}>
                <BrainCircuit size={14} className="text-yellow-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500">Neural Weights</span>
            </button>
          )}
          <button onClick={handleOpenKeySelector} className={`px-6 py-2.5 rounded-full text-[11px] font-black tracking-[0.2em] border ${state.isKeySelected ? 'border-green-500/30 bg-green-500/5 text-green-400' : 'border-yellow-500/50 bg-yellow-500 text-[#05080f]'}`}>
            {state.isKeySelected ? 'ENGINE ACTIVE' : 'SELECT PRO KEY'}
          </button>
        </div>
      </header>
      
      <main className="flex-1 relative">
        {state.currentMode === AppMode.LANDING ? (
          <LandingPage 
            onSelectMode={(m) => {
               if (m === AppMode.GROUP_PHOTO || m === AppMode.PORTRAIT_GENERATOR) {
                 setPendingMode(m);
                 setShowSeedModal(true);
               } else {
                 setState(prev => ({ ...prev, currentMode: m }));
               }
            }} 
          />
        ) : isEditorMode ? (
          <EditorWorkspace 
            mode={state.currentMode} 
            settings={state.settings} 
            negativePrompt={state.negativePrompt} 
            prompt={prompt} 
            canUndo={historyIndex > 0} 
            canRedo={historyIndex < history.length - 1} 
            onUndo={handleUndo} 
            onRedo={handleRedo} 
            onUpdatePrompt={(p) => setPrompt(p)} 
            onCommitPrompt={(p) => pushToHistory(p, state.settings, state.negativePrompt)} 
            neuralMemory={state.neuralWeights} 
            onUpdateSettings={(s) => { setState(prev => ({ ...prev, settings: s })); pushToHistory(prompt, s, state.negativePrompt); }} 
            onUpdateNegativePrompt={(np) => { setState(prev => ({ ...prev, negativePrompt: np })); pushToHistory(prompt, state.settings, np); }} 
            onGenerate={handleGenerate} 
            isLoading={isLoading} 
            previewImage={lastGeneratedImage} 
            onSelectFromGallery={(img) => setLastGeneratedImage(img)} 
            gallery={state.generatedGallery} 
            seeds={state.seeds} 
            onBackToHome={() => setState(prev => ({ ...prev, currentMode: AppMode.LANDING }))} 
            onRemoveSeed={(id) => setState(prev => ({ ...prev, seeds: prev.seeds.filter(s => s.id !== id) }))} 
            onRenameSeed={(id, name) => setState(prev => ({ ...prev, seeds: prev.seeds.map(s => s.id === id ? { ...s, name } : s) }))} 
            autoFillImage={autoFillImage} 
            onAutoFillConsumed={() => setAutoFillImage(null)} 
            onAddSeed={(data, name, tags) => setState(prev => ({ ...prev, seeds: [...prev.seeds, { id: `Seed_${Date.now()}`, imageData: data, name, tags }] }))} 
            onFeedback={handleFeedback}
          />
        ) : null}
      </main>

      {showMemoryLog && (
        <div className="fixed inset-0 z-[5000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
           <div className="w-full max-w-2xl bg-[#0a0f1d] border border-yellow-500/30 rounded-[2rem] overflow-hidden flex flex-col shadow-2xl">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-yellow-500/5">
                 <div className="flex items-center gap-3"><Terminal size={18} className="text-yellow-500" /><h3 className="text-sm font-black text-white uppercase tracking-widest">Neural Learning Logs</h3></div>
                 <div className="flex items-center gap-2">
                    <button onClick={handleClearMemory} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-all flex items-center gap-2 text-[9px] font-black uppercase"><Trash2 size={14} /> Purge Learning</button>
                    <button onClick={() => setShowMemoryLog(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400"><X size={18} /></button>
                 </div>
              </div>
              <div className="p-8 font-mono text-xs text-slate-300 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                 <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Database size={12} /> Active Biases</div>
                    <div className="whitespace-pre-wrap text-yellow-500/90 font-medium leading-relaxed">{state.neuralWeights}</div>
                 </div>
              </div>
           </div>
        </div>
      )}
      {showSeedModal && <SeedPromptModal onConfirm={(d, n, t) => { setState(prev => ({ ...prev, seeds: [...prev.seeds, { id: `Seed_${Date.now()}`, imageData: d, name: n, tags: t }], currentMode: pendingMode! })); setShowSeedModal(false); setAutoFillImage(d); }} onCancel={() => { if (pendingMode) setState(prev => ({ ...prev, currentMode: pendingMode })); setShowSeedModal(false); }} />}
    </div>
  );
};

export default App;