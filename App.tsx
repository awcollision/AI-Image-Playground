
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppMode, AvatarSeed, UserState, GenSettings, GalleryItem } from './types.ts';
import { generateImage, extractNeuralMemory } from './services/geminiService.ts';
import LandingPage from './components/LandingPage.tsx';
import EditorWorkspace from './components/EditorWorkspace.tsx';
import OnTheGoWorkspace from './components/OnTheGoWorkspace.tsx';
import SeedPromptModal from './components/SeedPromptModal.tsx';
import { Sparkles } from 'lucide-react';

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
      faceFidelity: 0.85, 
      strictness: 0.7,
      aspectRatio: "Original",
      numberOfImages: 1,
      imageSize: "1K",
      cameraAngle: "Default",
      pose: "Default"
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
    if (mode === AppMode.ON_THE_GO) {
      setState(prev => ({ ...prev, currentMode: mode }));
    } else {
      setPendingMode(mode);
      setShowSeedModal(true);
    }
  };

  const handleCreateSeed = (imageData: string, name: string, tags: string[]) => {
    const id = `Seed_${String(state.seeds.length + 1).padStart(3, '0')}`;
    const newSeed: AvatarSeed = { id, imageData, name, tags };
    setState(prev => ({ ...prev, seeds: [...prev.seeds, newSeed] }));
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
  };

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
        memoryContext: neuralMemory
      });

      if (response.images && response.images.length > 0) {
        const newImg = response.images[0];
        setLastGeneratedImage(newImg);
        
        const galleryItem: GalleryItem = {
          url: newImg,
          prompt: finalPrompt,
          settings: JSON.parse(JSON.stringify(state.settings)),
          timestamp: Date.now()
        };

        setState(prev => ({ 
          ...prev, 
          promptHistory: [...prev.promptHistory, finalPrompt].slice(-10),
          generatedGallery: [galleryItem, ...prev.generatedGallery].slice(0, 50)
        }));
      }
    } catch (error: any) {
      alert("Synthesis Issue: " + (error.message || "An error occurred."));
    } finally {
      setIsLoading(false);
    }
  };

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
        
        {state.currentMode === AppMode.ON_THE_GO && (
          <OnTheGoWorkspace 
            seeds={state.seeds} 
            settings={state.settings}
            onUpdateSettings={(s) => setState(prev => ({ ...prev, settings: s }))}
            onBackToHome={handleBackToHome}
            isKeySelected={state.isKeySelected}
            onAddSeed={(d, n, t) => {
              const id = `Seed_${String(state.seeds.length + 1).padStart(3, '0')}`;
              setState(prev => ({ ...prev, seeds: [...prev.seeds, { id, imageData: d, name: n, tags: t }] }));
            }}
            gallery={state.generatedGallery}
          />
        )}

        {(state.currentMode === AppMode.SINGLE_PLAY || state.currentMode === AppMode.GROUP_PHOTO) && (
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
          />
        )}
      </main>

      {showSeedModal && <SeedPromptModal onConfirm={handleCreateSeed} onCancel={skipSeedModal} />}
    </div>
  );
};

export default App;
