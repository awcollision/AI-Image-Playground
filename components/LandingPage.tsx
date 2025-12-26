
import React from 'react';
import { AppMode } from '../types';
import { Image as ImageIcon, Users, Zap, MessageSquare } from 'lucide-react';

interface Props {
  onSelectMode: (mode: AppMode) => void;
}

const LandingPage: React.FC<Props> = ({ onSelectMode }) => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-900 to-[#05080f]">
      <div className="text-center mb-16 space-y-4 max-w-2xl">
        <h2 className="text-6xl font-black tracking-tight text-white leading-none">
          AI IMAGE <span className="text-yellow-500">PLAYGROUND</span>
        </h2>
        <p className="text-slate-400 text-lg font-medium leading-relaxed">
          Create, composite, and manipulate images with professional-grade identity consistency.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 w-full max-w-6xl">
        <ModeCard 
          title="Single Play"
          description="Edit a single photograph. Swap styles, backgrounds, or items."
          icon={<ImageIcon size={32} />}
          onClick={() => onSelectMode(AppMode.SINGLE_PLAY)}
          color="yellow"
        />
        <ModeCard 
          title="Group Photo"
          description="Combine subjects from different photos into a single cohesive shot."
          icon={<Users size={32} />}
          onClick={() => onSelectMode(AppMode.GROUP_PHOTO)}
          color="blue"
        />
        <ModeCard 
          title="On the Go"
          description="Chat with Google-backed intelligence. Analyze locations and generate from search data."
          icon={<MessageSquare size={32} />}
          onClick={() => onSelectMode(AppMode.ON_THE_GO)}
          color="green"
        />
      </div>

      <div className="mt-20 flex items-center gap-8 opacity-40 grayscale pointer-events-none">
        <Zap size={20} />
        <span className="text-xs font-bold tracking-[0.3em] uppercase text-white">Powered by Nano Banana Pro</span>
        <Zap size={20} />
      </div>
    </div>
  );
};

const ModeCard = ({ title, description, icon, onClick, color }: any) => {
  let colorClass = 'hover:border-yellow-500 group-hover:bg-yellow-500';
  let shadowClass = 'hover:shadow-[0_0_40px_rgba(234,179,8,0.15)]';
  
  if (color === 'blue') {
    colorClass = 'hover:border-blue-500 group-hover:bg-blue-500';
    shadowClass = 'hover:shadow-[0_0_40px_rgba(59,130,246,0.15)]';
  } else if (color === 'green') {
    colorClass = 'hover:border-emerald-500 group-hover:bg-emerald-500';
    shadowClass = 'hover:shadow-[0_0_40px_rgba(16,185,129,0.15)]';
  }

  return (
    <button 
      onClick={onClick}
      className={`group relative text-left p-10 bg-slate-800/20 border border-white/5 rounded-[2rem] transition-all duration-500 ${colorClass} ${shadowClass} overflow-hidden`}
    >
      <div className="relative z-10 flex flex-col h-full">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-8 bg-slate-800 border border-white/5 transition-colors ${colorClass.split(' ')[1]} group-hover:text-[#05080f]`}>
          {icon}
        </div>
        <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-white">{title}</h3>
        <p className="text-slate-500 text-sm leading-relaxed group-hover:text-slate-300 transition-colors">
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
