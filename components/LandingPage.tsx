import React from 'react';
import { AppMode } from '../types.ts';
import { Users, Zap, Fingerprint, Gem, Layout, Youtube } from 'lucide-react';

interface Props {
  onSelectMode: (mode: AppMode) => void;
}

const LandingPage: React.FC<Props> = ({ onSelectMode }) => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-900 to-[#05080f]">
      <div className="text-center mb-16 space-y-4 max-w-2xl">
        <h2 className="text-6xl font-black tracking-tight text-white leading-none uppercase italic">
          Astra <span className="text-yellow-500">AI</span>
        </h2>
        <p className="text-slate-400 text-lg font-medium leading-relaxed">
          The world's most advanced biometric synthesis suite. Total control over identity, anatomy, and cinematic style.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 w-full max-w-5xl">
        <ModeCard 
          title="Group Photo"
          description="Combine subjects from different photos into a single cohesive shot with anatomical precision."
          icon={<Users size={32} />}
          onClick={() => onSelectMode(AppMode.GROUP_PHOTO)}
          color="blue"
        />
        <ModeCard 
          title="Portrait Generator"
          description="High-fidelity biometric reconstruction. Combine multiple references for perfect facial likeness."
          icon={<Fingerprint size={32} />}
          onClick={() => onSelectMode(AppMode.PORTRAIT_GENERATOR)}
          color="green"
        />
        <ModeCard 
          title="Thumbnail Creator"
          description="Design high-impact YouTube & Reel thumbnails. Optimized for 16:9 and 9:16 viral layouts."
          icon={<Layout size={32} />}
          onClick={() => onSelectMode(AppMode.THUMBNAIL_CREATOR)}
          color="yellow"
        />
        <ModeCard 
          title="Accessories Generator"
          description="Precision modeling for jewelry, textiles, and props. High-detail material synthesis."
          icon={<Gem size={32} />}
          onClick={() => onSelectMode(AppMode.ACCESSORIES_GENERATOR)}
          color="emerald"
        />
      </div>

      <div className="mt-20 flex items-center gap-8 opacity-40 grayscale pointer-events-none">
        <Zap size={20} />
        <span className="text-xs font-bold tracking-[0.3em] uppercase text-white">Neural Rig v4.0 Powered by Gemini 3</span>
        <Zap size={20} />
      </div>
    </div>
  );
};

const ModeCard = ({ title, description, icon, onClick, color }: any) => {
  let colorClass = 'hover:border-yellow-500 group-hover:bg-yellow-500';
  let iconBg = 'bg-yellow-500/10 text-yellow-500';
  
  // Default to White text on hover (Fixes Thumbnail Creator/Yellow)
  let hoverTextClass = 'group-hover:text-white'; 
  let hoverDescClass = 'group-hover:text-white/90';

  if (color === 'blue') {
    colorClass = 'hover:border-blue-500 group-hover:bg-blue-500';
    iconBg = 'bg-blue-500/10 text-blue-500';
  } else if (color === 'green') {
    colorClass = 'hover:border-emerald-500 group-hover:bg-emerald-500';
    iconBg = 'bg-emerald-500/10 text-emerald-500';
  } else if (color === 'emerald') {
    colorClass = 'hover:border-emerald-400 group-hover:bg-emerald-400';
    iconBg = 'bg-emerald-400/10 text-emerald-400';
  }

  return (
    <button 
      onClick={onClick}
      className={`group relative text-left p-10 bg-slate-800/20 border border-white/5 rounded-[2rem] transition-all duration-500 ${colorClass} overflow-hidden`}
    >
      <div className="relative z-10 flex flex-col h-full">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-8 border border-white/5 transition-colors ${iconBg} group-hover:bg-white/20 group-hover:text-white`}>
          {icon}
        </div>
        <h3 className={`text-2xl font-bold mb-4 text-white ${hoverTextClass}`}>{title}</h3>
        <p className={`text-slate-500 text-sm leading-relaxed transition-colors font-medium ${hoverDescClass}`}>
          {description}
        </p>
      </div>
      <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity">
        <Zap size={80} />
      </div>
    </button>
  );
};

export default LandingPage;