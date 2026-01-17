
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types.ts';
import { Send, Upload, User, Bot, Loader2, Sparkles, X, Download } from 'lucide-react';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string, images?: string[]) => void;
  isLoading: boolean;
  onSeedRequest: (imageData: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading, onSeedRequest }) => {
  const [input, setInput] = useState('');
  const [previews, setPreviews] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, previews]);

  const handleSend = () => {
    if ((input.trim() || previews.length > 0) && !isLoading) {
      onSendMessage(input, previews);
      setInput('');
      setPreviews([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    // Fixed: Explicitly cast Array.from result to File[] to avoid 'unknown' type inference in some environments
    const files = Array.from(fileList) as File[];
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string]);
      };
      // Fixed: Explicitly cast file to Blob to satisfy readAsDataURL signature when type inference is loose
      reader.readAsDataURL(file as Blob);
    });
    // Clear input so same file can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePreview = (index: number) => {
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth"
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                msg.role === 'user' ? 'bg-slate-700 border-slate-600' : 'bg-yellow-500/10 border-yellow-500/20'
              }`}>
                {msg.role === 'user' ? <User size={20} className="text-slate-300" /> : <Bot size={20} className="text-yellow-500" />}
              </div>
              <div className={`space-y-3 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' 
                  ? 'bg-yellow-500 text-slate-900 font-medium' 
                  : 'bg-slate-800 text-slate-200 border border-slate-700'
                }`}>
                  {msg.text}
                </div>
                {msg.images && msg.images.length > 0 && (
                  <div className={`flex flex-wrap gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.images.map((img, i) => (
                      <div key={i} className="group relative rounded-xl overflow-hidden border border-slate-700 shadow-md transition-transform hover:scale-[1.02]">
                        <img src={img} alt="Content" className="max-w-[280px] max-h-[400px] object-contain bg-black/20" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                           <button 
                            onClick={() => downloadImage(img, `nano-banana-${Date.now()}.png`)}
                            className="p-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/40 transition"
                            title="Download"
                           >
                             <Download size={18} className="text-white" />
                           </button>
                           {msg.role === 'assistant' && (
                             <button 
                              onClick={() => onSeedRequest(img)}
                              className="p-2 bg-yellow-500 text-slate-900 rounded-full hover:bg-yellow-400 transition"
                              title="Create Seed from this Image"
                             >
                               <Sparkles size={18} />
                             </button>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-3 max-w-[85%]">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-500/10 border-2 border-yellow-500/20 flex items-center justify-center">
                <Loader2 className="animate-spin text-yellow-500" size={20} />
              </div>
              <div className="bg-slate-800 text-slate-400 p-4 rounded-2xl text-sm italic border border-slate-700">
                Peeling bananas and generating magic... This might take up to a minute.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-800/50 border-t border-slate-700 backdrop-blur-xl">
        {previews.length > 0 && (
          <div className="flex gap-3 mb-4 overflow-x-auto pb-2 px-2">
            {previews.map((p, i) => (
              <div key={i} className="relative flex-shrink-0">
                <img src={p} className="h-20 w-20 object-cover rounded-lg border-2 border-yellow-500/50 shadow-lg" alt="Preview" />
                <button 
                  onClick={() => removePreview(i)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3 max-w-5xl mx-auto">
          <div className="flex-1 bg-slate-700/50 border border-slate-600 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-yellow-500/50 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your creative vision... Try 'Put him in a cyber-punk city' or reference a Seed ID"
              className="w-full bg-transparent border-none focus:ring-0 text-slate-200 text-sm p-3 min-h-[50px] max-h-32 resize-none"
            />
            <div className="flex justify-between items-center px-2 pb-1">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-yellow-400 hover:bg-slate-600 rounded-lg transition"
                title="Upload Photo"
              >
                <Upload size={20} />
              </button>
              <span className="text-[10px] text-slate-500 font-mono">
                {input.length} characters
              </span>
            </div>
          </div>
          <button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && previews.length === 0)}
            className="p-4 bg-yellow-500 text-slate-900 rounded-2xl shadow-lg shadow-yellow-500/20 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          multiple 
          accept="image/*" 
          className="hidden" 
        />
        <div className="mt-2 text-center text-[10px] text-slate-500 uppercase tracking-widest">
          Hold Shift + Enter for multi-line • AI Persona consistency enabled
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
