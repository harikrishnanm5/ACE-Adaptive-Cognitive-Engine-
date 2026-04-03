import React from 'react';
import { 
  X, 
  Upload, 
  Link as LinkIcon, 
  Search, 
  Loader2, 
  Globe,
  Zap,
  ArrowRight,
  Youtube,
  Cloud,
  Clipboard,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import { cn } from '../lib/utils';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  urlInput: string;
  setUrlInput: (url: string) => void;
  addUrlSource: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleWebSearch: () => Promise<void>;
  isProcessingSource: boolean;
  onDrop: (files: File[]) => void;
  sourceCount: number;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  isOpen,
  onClose,
  urlInput,
  setUrlInput,
  addUrlSource,
  searchQuery,
  setSearchQuery,
  handleWebSearch,
  isProcessingSource,
  onDrop,
  sourceCount
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'audio/*': ['.mp3', '.wav', '.m4a'],
      'video/*': ['.mp4', '.mov', '.webm'],
      'application/pdf': ['.pdf'],
    },
    multiple: true
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-[#1E1F22] border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-10 space-y-12">
          {/* Header */}
          <div className="flex items-start justify-between">
            <h2 className="text-3xl font-display font-medium text-white max-w-md leading-tight">
              Create Audio and Video Overviews from <br/>
              <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">your documents</span>
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-10">
            {/* Search Input Area */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-[1.5rem] blur opacity-25 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative bg-[#18191B] border border-white/5 rounded-3xl p-2 pl-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-slate-600" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search the web for new sources"
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 text-white placeholder:text-slate-600"
                />
                
                <div className="flex items-center gap-1.5 pr-2">
                  <button className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition-all uppercase tracking-wider">
                    <Globe className="w-3.5 h-3.5" />
                    Web
                  </button>
                  <button className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition-all uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5" />
                    Fast Research
                  </button>
                  <button 
                    onClick={handleWebSearch}
                    disabled={!searchQuery.trim() || isProcessingSource}
                    className="p-3 bg-white/5 rounded-xl text-slate-500 hover:text-indigo-400 transition-all"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Drop Zone Area */}
            <div 
              {...getRootProps()} 
              className={cn(
                "group relative border-2 border-dashed rounded-[3rem] p-16 text-center transition-all cursor-pointer overflow-hidden",
                isDragActive 
                  ? "border-blue-500 bg-blue-500/5" 
                  : "border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10"
              )}
            >
              <input {...getInputProps()} />
              
              <div className="space-y-6">
                <p className="text-2xl font-bold text-slate-200">or drop your files</p>
                <p className="text-sm font-bold text-slate-600">pdf, images, docs, audio, <span className="underline underline-offset-4 decoration-slate-700">and more</span></p>
                
                {/* Lower Action Row */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-6">
                  <button className="px-5 py-3 bg-white/5 border border-white/5 rounded-full flex items-center gap-3 text-xs font-bold text-slate-400 hover:bg-white/10 hover:text-white transition-all shadow-xl">
                    <Upload className="w-4 h-4" />
                    Upload files
                  </button>
                  <button className="px-5 py-3 bg-white/5 border border-white/5 rounded-full flex items-center gap-3 text-xs font-bold text-slate-400 hover:bg-white/10 hover:text-white transition-all shadow-xl">
                    <div className="flex items-center -space-x-1">
                      <LinkIcon className="w-3.5 h-3.5 text-red-500" />
                      <Youtube className="w-3.5 h-3.5 text-red-600" />
                    </div>
                    Websites
                  </button>
                  <button className="px-5 py-3 bg-white/5 border border-white/5 rounded-full flex items-center gap-3 text-xs font-bold text-slate-400 hover:bg-white/10 hover:text-white transition-all shadow-xl">
                    <Cloud className="w-4 h-4 text-emerald-500" />
                    Drive
                  </button>
                  <button className="px-5 py-3 bg-white/5 border border-white/5 rounded-full flex items-center gap-3 text-xs font-bold text-slate-400 hover:bg-white/10 hover:text-white transition-all shadow-xl">
                    <FileText className="w-4 h-4 text-slate-400" />
                    Copied text
                  </button>
                </div>
              </div>

              {isProcessingSource && (
                <div className="absolute inset-0 bg-[#1E1F22]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Processing Sources...</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Progress Footer */}
        <div className="p-8 pt-0 space-y-4">
          <div className="relative h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(sourceCount / 50) * 100}%` }}
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.5)]"
            />
          </div>
          <p className="text-right text-[10px] font-bold text-slate-700 uppercase tracking-widest">{sourceCount} / 50</p>
        </div>
      </motion.div>
    </div>
  );
};
