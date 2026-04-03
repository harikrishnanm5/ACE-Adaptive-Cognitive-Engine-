import React from 'react';
import { 
  Plus, 
  Search, 
  Loader2, 
  FileText, 
  Globe, 
  AudioLines, 
  Video, 
  Trash2, 
  ExternalLink,
  Zap,
  Layout,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Source } from '../hooks/useNotebook';

interface SidebarProps {
  sources: Source[];
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  setIsAddSourceModalOpen: (open: boolean) => void;
  isProcessingSource: boolean;
  activeSourceId: string | null;
  setActiveSourceId: (id: string | null) => void;
  removeSource: (id: string) => void;
  setSources: (sources: Source[]) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sources,
  isSidebarOpen,
  setIsSidebarOpen,
  setIsAddSourceModalOpen,
  isProcessingSource,
  activeSourceId,
  setActiveSourceId,
  removeSource,
  setSources
}) => {
  return (
    <motion.aside 
      initial={false}
      animate={{ width: isSidebarOpen ? 320 : 0 }}
      className="h-full border-r border-white/5 bg-[#1E1F22] flex flex-col relative z-20 overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-display font-semibold text-white">Sources</h2>
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400"
        >
          <Layout className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
        {/* Add Sources Button */}
        <button 
          onClick={() => setIsAddSourceModalOpen(true)}
          className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:bg-white/10 transition-all group"
        >
          <Plus className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
          <span className="text-xs font-bold uppercase tracking-wider">Add sources</span>
        </button>

        {/* Search Web Bar */}
        <div className="space-y-4">
          <div className="relative group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Search the web for new sources"
              className="w-full pl-11 pr-4 py-3 bg-white/[0.02] border border-white/5 rounded-2xl text-sm focus:ring-1 focus:ring-white/10 transition-all text-white placeholder:text-slate-600 outline-none"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button className="flex-1 py-2 px-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 hover:text-white transition-all">
              <Globe className="w-3 h-3" />
              Web
            </button>
            <button className="flex-1 py-2 px-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 hover:text-white transition-all">
              <Zap className="w-3 h-3 text-indigo-400" />
              Fast Research
            </button>
            <button className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all">
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Source List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Select all sources</h3>
            <CheckCircle2 className="w-4 h-4 text-slate-600" />
          </div>

          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {sources.map(source => {
                const Icon = {
                  text: FileText,
                  url: Globe,
                  audio: AudioLines,
                  video: Video
                }[source.sourceType as string] || FileText;

                return (
                  <motion.div
                    key={source.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border border-transparent",
                      activeSourceId === source.id 
                        ? "bg-white/5 border-white/10 text-white" 
                        : "text-slate-400 hover:text-slate-200"
                    )}
                    onClick={() => setActiveSourceId(source.id)}
                  >
                    <div className={cn(
                      "p-1.5 rounded-lg shrink-0",
                      activeSourceId === source.id ? "text-indigo-400" : "text-slate-600"
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold truncate flex-1">{source.name}</span>
                    {activeSourceId === source.id ? (
                      <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-700 group-hover:text-slate-500" />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {isProcessingSource && (
              <div className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Processing...</p>
              </div>
            )}

            {sources.length === 0 && !isProcessingSource && (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6 text-slate-700" />
                </div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No sources yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.aside>
  );
};
