
import React, { useState, useEffect } from 'react';
import { AppMode, AvatarSeed, UserState, GenSettings } from './types';
import { generateImage, extractNeuralMemory } from './services/geminiService';
import LandingPage from './components/LandingPage';
import EditorWorkspace from './components/EditorWorkspace';
import SeedPromptModal from './components/SeedPromptModal';
import { Key, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<UserState>({
    seeds: [],
    currentMode: AppMode.LANDING,
    isKeySelected: false,
    negativePrompt: '',
    promptHistory: [],
    settings: {
      temperature: 0.9, 
      variation: 0.5,
      faceFidelity: 0.85, 
      aspectRatio: "Original",
      numberOfImages: 1,
      imageSize: "1K",
      cameraAngle: "Default",
      pose: "Default"
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [pendingMode, setPendingMode] = useState<AppMode | null>(null);
  const [lastGeneratedImage, setLastGeneratedImage] = useState<string | null>(null);
  const [neuralMemory, setNeuralMemory] = useState<string>('');

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setState(prev => ({ ...prev, isKeySelected: selected }));
      }
    };
    checkKey();
  }, []);

  // Neural Memory self-learning logic
  useEffect(() => {
    if (state.promptHistory.length > 0 && state.promptHistory.length % 2 === 0) {
      extractNeuralMemory(state.promptHistory).then(memory => {
        if (memory) setNeuralMemory(memory);
      });
    }
  }, [state.promptHistory]);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setState(prev => ({ ...prev, isKeySelected: true }));
    }
  };

  const startModeSelection = (mode: AppMode) => {
    setPendingMode(mode);
    setShowSeedModal(true);
  };

  const handleCreateSeed = (imageData: string, name: string) => {
    const id = `Avatar_Seed_${String(state.seeds.length + 1).padStart(3, '0')}`;
    const newSeed: AvatarSeed = { id, imageData, name };
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

  const handleGenerate = async (prompt: string, images: string[], determinedRatio?: string) => {
    if (!state.isKeySelected) {
      alert("Please select a Pro API Key first.");
      return;
    }

    setIsLoading(true);
    try {
      const finalRatio = determinedRatio || (state.settings.aspectRatio === "Original" ? "1:1" : state.settings.aspectRatio);

      const response = await generateImage(prompt, images, {
        temperature: state.settings.temperature,
        aspectRatio: finalRatio,
        imageSize: state.settings.imageSize,
        faceFidelity: state.settings.faceFidelity,
        negativePrompt: state.negativePrompt,
        memoryContext: neuralMemory
      });

      if (response.images && response.images.length > 0) {
        setLastGeneratedImage(response.images[0]);
        // Update history for memory
        setState(prev => ({ ...prev, promptHistory: [...prev.promptHistory, prompt].slice(-10) }));
      } else {
        alert("Synthesis complete, but no image data returned.");
      }
    } catch (error: any) {
      alert("Generation failed: " + (error.message || "Unknown error"));
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
          {neuralMemory && (
            <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[10px] text-blue-400 font-black uppercase animate-pulse">
              <Sparkles size={14} /> Neural Memory Active
            </div>
          )}
          <button 
            onClick={handleOpenKeySelector}
            className={`flex items-center gap-2.5 px-6 py-2.5 rounded-full text-[11px] font-black tracking-[0.2em] transition-all border ${
              state.isKeySelected 
              ? 'border-green-500/30 bg-green-500/5 text-green-400' 
              : 'border-yellow-500/50 bg-yellow-500 text-[#05080f] hover:scale-105 shadow-[0_0_25px_rgba(234,179,8,0.2)]'
            }`}
          >
            PRO ACTIVE
          </button>
        </div>
      </header>

      <main className="flex-1 relative">
        {state.currentMode === AppMode.LANDING ? (
          <LandingPage onSelectMode={startModeSelection} />
        ) : (
          <EditorWorkspace 
            mode={state.currentMode}
            settings={state.settings}
            negativePrompt={state.negativePrompt}
            neuralMemory={neuralMemory}
            onUpdateSettings={(s) => setState(prev => ({ ...prev, settings: s }))}
            onUpdateNegativePrompt={(np) => setState(prev => ({ ...prev, negativePrompt: np }))}
            onGenerate={handleGenerate}
            isLoading={isLoading}
            previewImage={lastGeneratedImage}
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
