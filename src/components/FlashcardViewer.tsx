import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

interface Flashcard {
  front: string;
  back: string;
}

export const FlashcardViewer = ({ data }: { data: Flashcard[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex((prev) => (prev + 1) % data.length), 150);
  };
  
  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex((prev) => (prev - 1 + data.length) % data.length), 150);
  };

  if (!data || data.length === 0) return <div>No flashcards available.</div>;

  return (
    <div className="flex flex-col items-center space-y-8 w-full max-w-2xl mx-auto py-8">
      <div className="text-sm font-bold text-slate-500 uppercase tracking-widest bg-slate-900 border border-white/5 py-2 px-6 rounded-full shadow-lg">
        Card {currentIndex + 1} of {data.length}
      </div>

      <div 
        className="w-full h-80 relative cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <motion.div
          animate={{ rotateX: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
          style={{ transformStyle: "preserve-3d" }}
          className="w-full h-full relative"
        >
          {/* Front */}
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl" style={{ backfaceVisibility: "hidden" }}>
            <h3 className="text-2xl font-bold text-white mb-4 drop-shadow-md">Question</h3>
            <p className="text-xl text-slate-200 font-medium">{data[currentIndex].front}</p>
            <p className="absolute bottom-6 text-xs text-indigo-400 font-bold uppercase tracking-widest flex items-center gap-2">
              <RefreshCw className="w-3 h-3" /> Click to flip
            </p>
          </div>

          {/* Back */}
          <div 
            className="absolute inset-0 w-full h-full bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl"
            style={{ transform: "rotateX(180deg)", backfaceVisibility: "hidden" }}
          >
            <h3 className="text-2xl font-bold text-white mb-4 drop-shadow-md">Answer</h3>
            <p className="text-xl text-slate-200 font-medium">{data[currentIndex].back}</p>
          </div>
        </motion.div>
      </div>

      <div className="flex items-center gap-6">
        <button onClick={prevCard} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white border border-white/5 shadow-xl">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button onClick={nextCard} className="p-4 bg-indigo-600 hover:bg-indigo-700 rounded-full transition-all text-white shadow-xl shadow-indigo-500/20">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
