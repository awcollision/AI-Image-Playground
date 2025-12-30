
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppMode, AvatarSeed, UserState, GenSettings, GalleryItem } from './types.ts';
import { generateImage, extractNeuralMemory } from './services/geminiService.ts';
import LandingPage from './components/LandingPage.tsx';
import EditorWorkspace from './components/EditorWorkspace.tsx';
import OnTheGoWorkspace from './components/OnTheGoWorkspace.tsx';
import SeedPromptModal from './components/SeedPromptModal.tsx';
import { Sparkles, BrainCircuit, Activity, X, Terminal, Database, Radio } from 'lucide-react';

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
      strictness: 0.7,
      aspectRatio: "Original",
      numberOfImages: 1,
      imageSize: "1K",
      cameraAngle: "Default",
      pose: "Default",
      enableFilmGrain: false,
      stylePreset: "Cinematic (Default)"
    },
    negativePrompt: '',
    promptHistory: [],
    generatedGallery: [],
  });

  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoing = useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [pendingMode, setPendingMode] = useState<AppMode | null>(null);
  const [lastGeneratedImage, setLastGeneratedImage] = useState<string | null>(null);
  const [neuralMemory, setNeuralMemory] = useState<string>('');
  const [showMemoryLog, setShowMemoryLog] = useState(false);
  
  // State to pass newly created seed image to workspace for auto-filling
  const [autoFillImage, setAutoFillImage] = useState<string | null>(null);

  // Machine Learning Loop: Extract memory from history
  useEffect(() => {
    if (state.currentMode === AppMode.PORTRAIT_GENERATOR || state.currentMode === AppMode.GROUP_PHOTO) {
      const learnFromHistory = async () => {
        if (state.promptHistory.length > 0) {
          console.log("Neural Engine: Consolidating memory...");
          const memory = await extractNeuralMemory(state.promptHistory);
          if (memory) {
            console.log("Neural Engine: Memory Updated.", memory);
            setNeuralMemory(memory);
          }
        }
      };
      learnFromHistory();
    }
  }, [state.promptHistory.length, state.currentMode]);

  const pushToHistory = useCallback((p: string, s: GenSettings, np: string) => {
    if (isUndoRedoing.current) return;

    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      const nextState = { prompt: p, settings: JSON.parse(JSON.stringify(s)), negativePrompt: np };
      
      if (newHistory.length > 0) {
        const head = newHistory[newHistory.length - 1];
        if (head.prompt === p && head.negativePrompt === np && JSON.stringify(head.settings) === JSON.stringify(s)) {
          return prev;
        }
      }

      const updated = [...newHistory, nextState].slice(-50);
      setHistoryIndex(updated.length - 1);
      return updated;
    });
  }, [historyIndex]);

  useEffect(() => {
    if (history.length === 0) {
      pushToHistory(prompt, state.settings, state.negativePrompt);
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoing.current = true;
      const prevIndex = historyIndex - 1;
      const prevState = history[prevIndex];
      
      setPrompt(prevState.prompt);
      setState(prev => ({ 
        ...prev, 
        settings: prevState.settings, 
        negativePrompt: prevState.negativePrompt 
      }));
      setHistoryIndex(prevIndex);
      
      setTimeout(() => { isUndoRedoing.current = false; }, 50);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoing.current = true;
      const nextIndex = historyIndex + 1;
      const nextState = history[nextIndex];
      
      setPrompt(nextState.prompt);
      setState(prev => ({ 
        ...prev, 
        settings: nextState.settings, 
        negativePrompt: nextState.negativePrompt 
      }));
      setHistoryIndex(nextIndex);

      setTimeout(() => { isUndoRedoing.current = false; }, 50);
    }
  }, [history, historyIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) { handleRedo(); } else { handleUndo(); }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setState(prev => ({ ...prev, isKeySelected: selected }));
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setState(prev => ({ ...prev, isKeySelected: true }));
    }
  };

  const startModeSelection = (mode: AppMode) => {
    if (mode === AppMode.LANDING) return;
    
    // Portrait Generator skips the initial Seed Modal
    if (mode === AppMode.PORTRAIT_GENERATOR) {
      setState(prev => ({ ...prev, currentMode: mode }));
      return;
    }
    
    // Group Photo now REQUIRES the initial Seed Modal as per user request
    if (mode === AppMode.GROUP_PHOTO) {
      setPendingMode(mode);
      setShowSeedModal(true);
      return;
    }
    
    // Single Play also uses seed modal usually, or can skip.
    setState(prev => ({ ...prev, currentMode: mode }));
  };

  const handleCreateSeed = (imageData: string, name: string, tags: string[]) => {
    const id = `Seed_${String(state.seeds.length + 1).padStart(3, '0')}`;
    const newSeed: AvatarSeed = { id, imageData, name, tags };
    setState(prev => ({ ...prev, seeds: [...prev.seeds, newSeed] }));
    
    // Auto-fill logic for Group Photo: capture the image to populate Slot 1
    if (pendingMode === AppMode.GROUP_PHOTO) {
      setAutoFillImage(imageData);
    }
    
    if (pendingMode) setState(prev => ({ ...prev, currentMode: pendingMode }));
    setShowSeedModal(false);
  };

  const handleRemoveSeed = (id: string) => {
    setState(prev => ({ ...prev, seeds: prev.seeds.filter(s => s.id !== id) }));
  };

  const handleRenameSeed = (id: string, newName: string) => {
    setState(prev => ({
      ...prev,
      seeds: prev.seeds.map(s => s.id === id ? { ...s, name: newName } : s)
    }));
  };

  const skipSeedModal = () => {
    if (pendingMode) setState(prev => ({ ...prev, currentMode: pendingMode }));
    setShowSeedModal(false);
  };

  const handleBackToHome = () => {
    setState(prev => ({ ...prev, currentMode: AppMode.LANDING }));
    setLastGeneratedImage(null);
    setAutoFillImage(null);
  };

  const onAddToGallery = useCallback((url: string, promptText: string) => {
    const galleryItem: GalleryItem = {
      url,
      prompt: promptText,
      settings: JSON.parse(JSON.stringify(state.settings)),
      timestamp: Date.now()
    };
    setState(prev => ({
      ...prev,
      generatedGallery: [galleryItem, ...prev.generatedGallery].slice(0, 50)
    }));
  }, [state.settings]);

  const handleGenerate = async (finalPrompt: string, images: string[], determinedRatio?: string) => {
    if (!state.isKeySelected) {
      alert("Please select a Pro API Key first.");
      return;
    }

    setIsLoading(true);
    try {
      const finalRatio = determinedRatio || (state.settings.aspectRatio === "Original" ? "1:1" : state.settings.aspectRatio);
      const response = await generateImage(finalPrompt, images, {
        temperature: state.settings.temperature,
        aspectRatio: finalRatio as any,
        imageSize: state.settings.imageSize as any,
        faceFidelity: state.settings.faceFidelity,
        strictness: state.settings.strictness,
        negativePrompt: state.negativePrompt,
        memoryContext: neuralMemory,
        enableFilmGrain: state.settings.enableFilmGrain,
        mode: state.currentMode,
        stylePreset: state.settings.stylePreset // Passing new style preset
      });

      if (response.images && response.images.length > 0) {
        const newImg = response.images[0];
        setLastGeneratedImage(newImg);
        onAddToGallery(newImg, finalPrompt);
        
        setState(prev => ({ 
          ...prev, 
          promptHistory: [...prev.promptHistory, finalPrompt].slice(-10)
        }));
      }
    } catch (error: any) {
      alert("Synthesis Issue: " + (error.message || "An error occurred."));
    } finally {
      setIsLoading(false);
    }
  };

  // Check if we should render EditorWorkspace (for Portrait & Group Photo)
  const isEditorMode = state.currentMode === AppMode.PORTRAIT_GENERATOR || state.currentMode === AppMode.GROUP_PHOTO;

  return (
    <div className="flex flex-col h-screen bg-[#05080f] text-slate-100 overflow-hidden font-sans selection:bg-yellow-500/30">
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-[#05080f]/80 backdrop-blur-xl z-50">
        <div className="flex items-center gap-4 cursor-pointer group" onClick={handleBackToHome}>
          <div className="bg-yellow-500 p-2.5 rounded-2xl group-hover:rotate-12 transition-all shadow-[0_0_30px_rgba(234,179,8,0.3)] duration-500">
            <Sparkles size={22} className="text-[#05080f]" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter uppercase italic text-yellow-500">
            Banana <span className="text-white">Pro</span>
          </h1>
        </div>

        <div className="flex items-center gap-8">
          {/* Live Learning Indicator - ONLY for Editor Modes */}
          {isEditorMode && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-white/5">
               <Radio size={14} className={neuralMemory ? "text-red-500 animate-pulse" : "text-slate-600"} />
               <span className={`text-[9px] font-black uppercase tracking-widest ${neuralMemory ? "text-slate-200" : "text-slate-600"}`}>
                 Live Learning
               </span>
            </div>
          )}

          {isEditorMode && (
            <button 
              onClick={() => setShowMemoryLog(true)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-full transition-all group cursor-pointer animate-in fade-in ${
                neuralMemory 
                  ? 'bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
              title="View Learning Logs"
            >
                <div className="relative">
                   <BrainCircuit size={14} className={neuralMemory ? "text-yellow-500 group-hover:scale-110 transition-transform" : "text-slate-500"} />
                   {neuralMemory && <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full animate-ping opacity-75" />}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${neuralMemory ? "text-yellow-500" : "text-slate-500"}`}>
                  {neuralMemory ? "Neural Active" : "Neural Online"}
                </span>
            </button>
          )}
          <button 
            onClick={handleOpenKeySelector}
            className={`flex items-center gap-2.5 px-6 py-2.5 rounded-full text-[11px] font-black tracking-[0.2em] transition-all border ${
              state.isKeySelected 
              ? 'border-green-500/30 bg-green-500/5 text-green-400' 
              : 'border-yellow-500/50 bg-yellow-500 text-[#05080f] hover:scale-105 shadow-[0_0_25px_rgba(234,179,8,0.2)]'
            }`}
          >
            {state.isKeySelected ? 'PRO ACTIVE' : 'SELECT PRO KEY'}
          </button>
        </div>
      </header>

      <main className="flex-1 relative">
        {state.currentMode === AppMode.LANDING && <LandingPage onSelectMode={startModeSelection} />}
        
        {isEditorMode && (
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
            neuralMemory={neuralMemory}
            onUpdateSettings={(s) => {
              setState(prev => ({ ...prev, settings: s }));
              pushToHistory(prompt, s, state.negativePrompt);
            }}
            onUpdateNegativePrompt={(np) => {
              setState(prev => ({ ...prev, negativePrompt: np }));
              pushToHistory(prompt, state.settings, np);
            }}
            onGenerate={handleGenerate}
            isLoading={isLoading}
            previewImage={lastGeneratedImage}
            onSelectFromGallery={(img) => setLastGeneratedImage(img)}
            gallery={state.generatedGallery}
            seeds={state.seeds}
            onBackToHome={handleBackToHome}
            onRemoveSeed={handleRemoveSeed}
            onRenameSeed={handleRenameSeed}
            // Pass the auto-fill image if available
            autoFillImage={autoFillImage}
            onAutoFillConsumed={() => setAutoFillImage(null)}
          />
        )}

        {state.currentMode === AppMode.SINGLE_PLAY && (
          <OnTheGoWorkspace 
            seeds={state.seeds}
            settings={state.settings}
            onUpdateSettings={(s) => setState(prev => ({ ...prev, settings: s }))}
            onBackToHome={handleBackToHome}
            onAddSeed={handleCreateSeed}
            isKeySelected={state.isKeySelected}
            gallery={state.generatedGallery}
            onAddToGallery={onAddToGallery}
          />
        )}
      </main>

      {/* Neural Memory Log Modal (Relevant for both Editor Modes) */}
      {showMemoryLog && isEditorMode && (
        <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
           <div className="w-full max-w-2xl bg-[#0a0f1d] border border-yellow-500/30 rounded-[2rem] overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.1)] flex flex-col">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-yellow-500/5">
                 <div className="flex items-center gap-3">
                    <Terminal size={18} className="text-yellow-500" />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Neural Latent State</h3>
                 </div>
                 <button onClick={() => setShowMemoryLog(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all"><X size={18} /></button>
              </div>
              
              <div className="p-8 font-mono text-xs leading-relaxed text-slate-300 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                 <div className="flex items-center gap-3 text-emerald-500 mb-2">
                    <Activity size={14} className="animate-pulse" />
                    <span className="font-bold uppercase tracking-widest">System Online • Learning Active</span>
                 </div>
                 
                 <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <Database size={12} />
                       Memory Dump
                    </div>
                    {neuralMemory ? (
                      <div className="whitespace-pre-wrap text-yellow-500/90 font-medium">
                        {neuralMemory}
                      </div>
                    ) : (
                      <div className="text-slate-600 italic">Initializing latent capture... Provide more prompts to begin learning.</div>
                    )}
                 </div>
                 
                 <div className="text-[10px] text-slate-500">
                    <p>LOG_ID: {Date.now()}</p>
                    <p>STATUS: Watching input stream for correction patterns.</p>
                 </div>
              </div>
              
              <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end">
                 <button onClick={() => setShowMemoryLog(false)} className="px-6 py-2 bg-yellow-500 text-[#05080f] font-black uppercase text-[10px] tracking-widest rounded-lg hover:bg-yellow-400 transition-colors">Close Log</button>
              </div>
           </div>
        </div>
      )}

      {showSeedModal && <SeedPromptModal onConfirm={handleCreateSeed} onCancel={skipSeedModal} />}
    </div>
  );
};

export default App;
