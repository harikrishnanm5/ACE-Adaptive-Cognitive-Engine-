import React, { useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export const QuizViewer = ({ data }: { data: QuizQuestion[] }) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  const handleSelect = (qIndex: number, oIndex: number) => {
    if (showResults) return;
    setAnswers(prev => ({ ...prev, [qIndex]: oIndex }));
  };

  const calculateScore = () => {
    let score = 0;
    data.forEach((q, i) => {
      if (answers[i] === q.correctAnswer) score++;
    });
    return score;
  };

  if (!data || data.length === 0) return <div>No quiz data available.</div>;

  if (showResults) {
    const score = calculateScore();
    return (
      <div className="space-y-8 max-w-3xl mx-auto w-full py-8">
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 text-center space-y-4 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full" />
          <h2 className="text-4xl font-display font-bold text-white relative z-10">Quiz Complete!</h2>
          <p className="text-lg text-slate-400 relative z-10">
            You scored <span className="text-indigo-400 font-bold text-2xl">{score}</span> out of {data.length}
          </p>
          <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden mt-6 relative z-10 shadow-inner">
            <div 
              className="bg-indigo-500 h-full rounded-full transition-all duration-1000"
              style={{ width: `${(score / data.length) * 100}%` }}
            />
          </div>
          <button 
            onClick={() => { setAnswers({}); setShowResults(false); }}
            className="mt-8 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white font-bold flex items-center gap-2 mx-auto transition-all border border-white/10 relative z-10"
          >
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
        </div>

        <div className="space-y-6">
          {data.map((q, i) => (
            <div key={i} className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white">
                <span className="text-indigo-400 mr-2">{i + 1}.</span>
                {q.question}
              </h3>
              <div className="space-y-3 mt-4">
                {q.options.map((opt, j) => {
                  const isSelected = answers[i] === j;
                  const isCorrect = q.correctAnswer === j;
                  let bgClass = "bg-slate-800 border-white/5";
                  if (showResults) {
                    if (isCorrect) bgClass = "bg-emerald-500/20 border-emerald-500/50 text-emerald-200 shadow-lg shadow-emerald-500/10";
                    else if (isSelected && !isCorrect) bgClass = "bg-red-500/20 border-red-500/50 text-red-200 shadow-lg shadow-red-500/10";
                  }
                  
                  return (
                    <div key={j} className={cn("p-4 rounded-xl border flex items-center justify-between transition-all", bgClass)}>
                      <span className="font-medium text-sm">{opt}</span>
                      {showResults && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 ml-4" />}
                      {showResults && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 ml-4" />}
                    </div>
                  );
                })}
              </div>
              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-5 mt-6 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/50" />
                <p className="text-sm text-indigo-200 leading-relaxed"><span className="font-bold text-indigo-400 uppercase tracking-widest text-[10px] block mb-1">Explanation</span> {q.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto w-full py-8">
      {data.map((q, i) => (
        <div key={i} className="bg-slate-900 border border-white/10 rounded-3xl p-8 space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 font-display font-bold text-6xl text-white pointer-events-none">
            {i + 1}
          </div>
          <h3 className="text-xl font-bold text-white leading-relaxed z-10 relative">
            <span className="text-indigo-400 mr-2">{i + 1}.</span> {q.question}
          </h3>
          <div className="grid grid-cols-1 gap-3 z-10 relative">
            {q.options.map((opt, j) => (
              <button
                key={j}
                onClick={() => handleSelect(i, j)}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all hover:scale-[1.01] flex items-center gap-4",
                  answers[i] === j 
                    ? "bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/20 text-white" 
                    : "bg-slate-800/80 border-white/5 text-slate-300 hover:bg-slate-700 hover:border-white/10"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  answers[i] === j ? "border-indigo-400 bg-indigo-500" : "border-slate-500"
                )}>
                  {answers[i] === j && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span className="font-medium text-sm">{opt}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-center pt-8 border-t border-white/10">
        <button 
          onClick={() => setShowResults(true)}
          disabled={Object.keys(answers).length !== data.length}
          className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all shadow-xl shadow-indigo-500/20 text-lg flex items-center gap-3"
        >
          Check Answers
        </button>
      </div>
    </div>
  );
};
