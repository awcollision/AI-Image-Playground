
import React from 'react';
import { AvatarSeed } from '../types.ts';
import { X, Copy, Trash2, ShieldCheck, Sparkles } from 'lucide-react';

interface SeedManagerProps {
  seeds: AvatarSeed[];
  onClose: () => void;
}

const SeedManager: React.FC<SeedManagerProps> = ({ seeds, onClose }) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="text-yellow-500" size={20} />
            AI Avatar Seeds
          </h2>
          <p className="text-xs text-slate-500 mt-1">Identity lockers for consistency</p>
        </div>
        <button 
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {seeds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-500">
              <ShieldCheck size={32} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">No seeds created yet</p>
              <p className="text-xs text-slate-500 mt-1">Upload an image and ask to "create an avatar seed" to preserve identity across edits.</p>
            </div>
          </div>
        ) : (
          seeds.map((seed) => (
            <div key={seed.id} className="bg-slate-700/50 border border-slate-600 rounded-xl overflow-hidden group">
              <div className="relative aspect-square bg-slate-900">
                <img src={seed.imageData} alt={seed.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => copyToClipboard(seed.id)}
                      className="flex-1 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white text-[10px] py-1.5 rounded flex items-center justify-center gap-1 transition"
                    >
                      <Copy size={12} />
                      Copy ID
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-yellow-500 truncate">{seed.id}</span>
                  <button className="text-slate-500 hover:text-red-400 transition">
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-slate-300 truncate">{seed.name}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-slate-900/50 text-[10px] text-slate-500 leading-tight">
        <p>Pro Tip: Use <code className="text-yellow-500/80 bg-slate-800 px-1 rounded">Seed_000...</code> in your prompts to maintain 95%+ fidelity to the original subject's facial structure and proportions.</p>
      </div>
    </div>
  );
};

export default SeedManager;
