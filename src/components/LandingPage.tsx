import React from 'react';
import { Brain, Globe, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface LandingPageProps {
  login: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ login }) => {
  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-4 space-y-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative"
      >
        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
        <div className="relative w-24 h-24 bg-slate-900 border border-white/10 rounded-[2.5rem] flex items-center justify-center shadow-2xl">
          <Brain className="w-12 h-12 text-indigo-400" />
        </div>
      </motion.div>

      <div className="text-center space-y-4 max-w-2xl relative z-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <Zap className="w-3 h-3 text-indigo-400" />
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em]">Adaptive Cognitive Engine</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-white tracking-tight mb-2">ACE</h1>
          <p className="text-slate-400 text-lg md:text-xl leading-relaxed max-w-lg mx-auto">
            Your interactive AI research strategist. Organize, analyze, and master any subject with real-time hybrid reasoning.
          </p>
        </motion.div>
      </div>

      <motion.button 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onClick={login}
        className="px-10 py-5 bg-indigo-600 text-white rounded-3xl font-bold hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-500/40 flex items-center gap-4 text-xl group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        <Globe className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        Sign in with Google
      </motion.button>

      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-slate-600 text-[10px] font-bold uppercase tracking-widest"
      >
        Powered by Gemini & Groq
      </motion.p>
    </div>
  );
};
