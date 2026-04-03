import React, { useState } from 'react';
import { 
  Loader2, 
  Sparkles, 
  StickyNote, 
  Presentation, 
  AudioLines, 
  RefreshCw,
  Video,
  Network,
  HelpCircle,
  FileText,
  Layout,
  BarChart3,
  Table,
  ChevronRight,
  MoreVertical,
  Play,
  Square,
  Waves,
  Plus,
  MessageSquare,
  Download,
  Trash2,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { User } from '../hooks/useAuth';
import { Source, Note, useNotebook } from '../hooks/useNotebook';
import { useTTS } from '../hooks/useTTS';
import { deepgramTTS } from '../hooks/useAIServices';
import { stripMarkdown } from '../lib/text';
import pptxgen from 'pptxgenjs';
import { MindMapViewer } from './MindMapViewer';

interface StudioPanelProps {
  isGeneratingStudioContent: boolean;
  studioContent: { type: string; content: string } | null;
  setStudioContent: (content: { type: string; content: string } | null) => void;
  currentNotebookId: string | null;
  user: User;
  sources: Source[];
  notes: Note[];
  addNote: (notebookId: string, note: Omit<Note, 'id' | 'createdAt'>) => Promise<void>;
  notebookContent: string;
  generateNotebookGuide: () => Promise<void>;
  setIsVersionHistoryOpen: (open: boolean) => void;
  isLoading: boolean;
  useStudioTool: (toolType: string) => Promise<void>;
  setIsInteractiveModeOpen: (content?: string) => void;
  removeNote: (notebookId: string, noteId: string) => Promise<void>;
}

export const StudioPanel: React.FC<StudioPanelProps> = ({
  isGeneratingStudioContent,
  studioContent,
  setStudioContent,
  currentNotebookId,
  user,
  sources,
  notes,
  addNote,
  notebookContent,
  generateNotebookGuide,
  setIsVersionHistoryOpen,
  isLoading,
  useStudioTool,
  setIsInteractiveModeOpen,
  removeNote
}) => {
  const { speak, stop, isSpeaking: isTtsSpeaking, isOnline } = useTTS();
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const tools = [
    { id: 'audio', label: 'Audio Overview', icon: AudioLines },
    { id: 'slides', label: 'Slide Deck', icon: Presentation, beta: true },
    { id: 'mindmap', label: 'Mind Map', icon: Network },
    { id: 'report', label: 'Reports', icon: FileText },
    { id: 'flashcards', label: 'Flashcards', icon: StickyNote },
    { id: 'quiz', label: 'Quiz', icon: HelpCircle },
  ];

  const handlePlayAudio = (note: Note) => {
    if (playingNoteId === note.id && isTtsSpeaking) {
      stop();
      setPlayingNoteId(null);
    } else {
      setPlayingNoteId(note.id);
      // Clean script usually starts after "Title: ...\n\n"
      let cleanContent = note.content.split('\n\n').slice(1).join('\n\n') || note.content;
      
      // Final Sanitization Pass for Pure TTS Mode
      const cleanedMessage = stripMarkdown(cleanContent);
      speak(cleanedMessage);
    }
  };

  const getNoteIcon = (type: string) => {
    const tool = tools.find(t => t.id === type);
    return tool ? tool.icon : FileText;
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  const handleDownload = async () => {
    if (!studioContent) return;
    try {
      if (studioContent.type === 'slides') {
        const match = studioContent.content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        const rawJson = match ? match[0] : studioContent.content.replace(/```json|```/gi, '').trim();
        const slidesData = JSON.parse(rawJson);

        const pptx = new pptxgen();
        pptx.layout = 'LAYOUT_WIDE'; // 16:9
        pptx.author = 'ACE - Adaptive Cognitive Engine';

        // Dark master theme colors
        const BG = '0D0F14';
        const TITLE_COLOR = 'FFFFFF';
        const BODY_COLOR = 'CBD5E1';
        const FOOTER_COLOR = '475569';

        slidesData.forEach((s: any, idx: number) => {
          const slide = pptx.addSlide();
          const accentHex = (s.accent || '#6366f1').replace('#', '');

          // Background
          slide.background = { fill: BG };

          // Accent top bar (gradient feel using two overlapping rects)
          slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.12, fill: { color: accentHex }, line: { type: 'none' } });
          slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0.12, w: '100%', h: 0.04, fill: { color: accentHex + '44' }, line: { type: 'none' } });

          // Slide number badge
          slide.addText(`${idx + 1}`, {
            x: 11.8, y: 0.18, w: 0.5, h: 0.35, fontSize: 9, color: accentHex, bold: true, align: 'center'
          });

          const isTitle = idx === 0;

          if (isTitle) {
            // Title slide layout
            slide.addText(s.title || 'Presentation', {
              x: 0.8, y: 1.8, w: 10.4, h: 1.4,
              fontSize: 44, bold: true, color: TITLE_COLOR,
              align: 'center', fontFace: 'Calibri'
            });
            if (s.subtitle || s.notes) {
              slide.addText(s.subtitle || s.notes || '', {
                x: 1.5, y: 3.4, w: 9, h: 0.8,
                fontSize: 18, color: accentHex, align: 'center', fontFace: 'Calibri'
              });
            }
            // Decorative accent line
            slide.addShape(pptx.ShapeType.rect, { x: 4.5, y: 4.4, w: 3, h: 0.05, fill: { color: accentHex }, line: { type: 'none' } });
            slide.addText('ACE · Adaptive Cognitive Engine', {
              x: 0, y: 6.8, w: '100%', h: 0.3,
              fontSize: 9, color: FOOTER_COLOR, align: 'center', fontFace: 'Calibri'
            });
          } else {
            // Content slide layout
            slide.addText(s.title || `Slide ${idx + 1}`, {
              x: 0.6, y: 0.35, w: 11, h: 0.95,
              fontSize: 28, bold: true, color: TITLE_COLOR, fontFace: 'Calibri'
            });
            // Divider line
            slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.35, w: 10.8, h: 0.025, fill: { color: accentHex + '55' }, line: { type: 'none' } });

            if (s.subtitle) {
              slide.addText(s.subtitle, {
                x: 0.6, y: 1.45, w: 10.8, h: 0.4,
                fontSize: 13, color: accentHex, fontFace: 'Calibri', italic: true
              });
            }

            if (s.bullets && Array.isArray(s.bullets)) {
              const startY = s.subtitle ? 2.0 : 1.6;
              s.bullets.forEach((bullet: string, bi: number) => {
                slide.addShape(pptx.ShapeType.ellipse, {
                  x: 0.6, y: startY + bi * 0.72 + 0.14, w: 0.1, h: 0.1,
                  fill: { color: accentHex }, line: { type: 'none' }
                });
                slide.addText(bullet, {
                  x: 0.85, y: startY + bi * 0.72, w: 10.5, h: 0.6,
                  fontSize: 15, color: BODY_COLOR, fontFace: 'Calibri', valign: 'middle'
                });
              });
            }

            // Footer
            slide.addText('ACE · Adaptive Cognitive Engine', {
              x: 0, y: 6.8, w: '100%', h: 0.3,
              fontSize: 9, color: FOOTER_COLOR, align: 'center', fontFace: 'Calibri'
            });
          }

          if (s.notes) slide.addNotes(s.notes);
        });

        await pptx.writeFile({ fileName: `ACE_Presentation_${Date.now()}.pptx` });
      } else {
        const blob = new Blob([studioContent.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ACE_${studioContent.type}_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
      alert("Error generating file. The AI response may not have parsed correctly.");
    }
  };

  const handleDownloadAudio = async (text: string, title: string) => {
    try {
      const cleanedText = stripMarkdown(text.split('\n\n').slice(1).join('\n\n') || text);
      const blob = await deepgramTTS(cleanedText);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ACE_Audio_${title.replace(/\s+/g, '_')}_${Date.now()}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Audio download failed:", err);
      alert("Failed to generate audio file. Please check your connection and API key.");
    }
  };

  const handleQuizSelect = (questionIndex: number, optionIndex: number) => {
    if (quizAnswers[questionIndex] !== undefined) return; // Prevent changing answer once selected
    setQuizAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const renderStudioContent = () => {
    if (!studioContent) return null;
    if (studioContent.type === 'quiz') {
      try {
        // Robust extraction: Hunt for the literal JSON array signature to ignore conversational wrapping
        const match = studioContent.content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        const rawJson = match ? match[0] : studioContent.content.replace(/```json|```/gi, '').trim();
        const quizData = JSON.parse(rawJson);
        
        let score = 0;
        let totalAnswered = Object.keys(quizAnswers).length;
        
        quizData.forEach((q: any, i: number) => {
          if (quizAnswers[i] === q.correctAnswer) score++;
        });

        const isFullyComplete = totalAnswered === quizData.length;

        return (
          <div className="space-y-8 max-w-3xl mx-auto pb-24">
            {isFullyComplete && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-indigo-500/10 border border-indigo-500/30 p-8 rounded-[2rem] text-center space-y-3"
              >
                <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Final Score</h2>
                <div className="text-6xl font-black text-indigo-400">{score} <span className="text-3xl text-indigo-500/50">/ {quizData.length}</span></div>
                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest pt-2">
                  {score === quizData.length ? 'Perfect!' : score > quizData.length / 2 ? 'Great working knowledge.' : 'Needs more review.'}
                </p>
              </motion.div>
            )}

            {quizData.map((q: any, i: number) => (
              <div key={i} className="bg-white/[0.02] border border-white/5 p-8 rounded-[2rem] space-y-6 shadow-xl">
                <h3 className="text-xl font-bold text-white leading-relaxed"><span className="text-indigo-400 mr-2 text-2xl">Q{i + 1}.</span> {q.question}</h3>
                <div className="space-y-3">
                  {q.options.map((opt: string, j: number) => {
                    const isAnswered = quizAnswers[i] !== undefined;
                    const isSelected = quizAnswers[i] === j;
                    const isCorrect = j === q.correctAnswer;
                    
                    let btnClass = "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:border-white/20 cursor-pointer";
                    if (isAnswered) {
                      if (isCorrect) btnClass = "bg-green-500/10 border-green-500/30 text-green-400 font-bold border-2 shadow-inner shadow-green-500/10";
                      else if (isSelected && !isCorrect) btnClass = "bg-red-500/10 border-red-500/30 text-red-400 font-bold opacity-75 border-2 shadow-inner shadow-red-500/10";
                      else btnClass = "bg-white/5 border-white/5 text-slate-500 opacity-50 cursor-default";
                    }

                    return (
                      <div 
                        key={j} 
                        onClick={() => handleQuizSelect(i, j)}
                        className={cn("p-4 rounded-xl flex items-center gap-4 transition-all", btnClass)}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors", 
                          isAnswered ? (isCorrect ? "bg-green-500 text-white" : isSelected ? "bg-red-500 text-white" : "bg-white/10 text-slate-500") : "bg-white/10 text-slate-400"
                        )}>
                          {String.fromCharCode(65 + j)}
                        </div>
                        <span className="flex-1 text-sm">{opt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            
          </div>
        );
      } catch (err) {}
    }
    if (studioContent.type === 'slides') {
      try {
        const match = studioContent.content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        const rawJson = match ? match[0] : studioContent.content.replace(/```json|```/gi, '').trim();
        const slides = JSON.parse(rawJson);
        const idx = Math.min(currentCardIndex, slides.length - 1);
        const slide = slides[idx];
        const accent = slide.accent || '#6366f1';

        return (
          <div className="flex flex-col items-center gap-8 w-full max-w-4xl mx-auto py-4">
            {/* Slide Progress */}
            <div className="flex items-center gap-2 w-full px-4">
              {slides.map((_: any, i: number) => (
                <div 
                  key={i} 
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-all duration-300", 
                    i === idx ? "bg-indigo-500 scale-y-110 shadow-[0_0_10px_rgba(99,102,241,0.5)]" : "bg-white/10"
                  )} 
                />
              ))}
            </div>
            
            <div className="w-full flex items-center justify-between px-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] bg-white/5 px-3 py-1 rounded-full border border-white/5">
                Slide {idx + 1} of {slides.length}
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accent }} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Preview</span>
              </div>
            </div>

            {/* Slide Canvas */}
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative w-full aspect-video bg-[#0D0F14] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col group"
            >
              {/* Accent Bar */}
              <div className="h-2 w-full" style={{ backgroundColor: accent }} />
              
              <div className="flex-1 p-12 flex flex-col">
                <div className="space-y-4">
                  <h3 className="text-4xl font-bold text-white tracking-tight leading-tight">{slide.title}</h3>
                  {slide.subtitle && (
                    <p className="text-lg font-medium italic opacity-60" style={{ color: accent }}>{slide.subtitle}</p>
                  )}
                  <div className="w-20 h-1 rounded-full opacity-30 mt-6" style={{ backgroundColor: accent }} />
                </div>

                <div className="flex-1 mt-12 space-y-6">
                  {slide.bullets && Array.isArray(slide.bullets) && slide.bullets.map((bullet: string, bi: number) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * bi }}
                      key={bi} 
                      className="flex items-start gap-4"
                    >
                      <div className="mt-2 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                      <p className="text-xl text-slate-300 leading-relaxed font-medium">{bullet}</p>
                    </motion.div>
                  ))}
                  {!slide.bullets && slide.notes && (
                    <p className="text-lg text-slate-400 italic leading-relaxed">{slide.notes}</p>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between pt-8 border-t border-white/5">
                  <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">ACE · Adaptive Cognitive Engine</p>
                  <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Proprietary Research Tool</p>
                </div>
              </div>
            </motion.div>

            {/* Navigation & Controls */}
            <div className="flex flex-col items-center gap-6 w-full">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => { setCurrentCardIndex(i => Math.max(0, i - 1)); }}
                  disabled={idx === 0}
                  className="w-14 h-14 flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-6 h-6 rotate-180" />
                </button>
                <button
                  onClick={() => { setCurrentCardIndex(i => Math.min(slides.length - 1, i + 1)); }}
                  disabled={idx === slides.length - 1}
                  className="w-14 h-14 flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              {slide.notes && (
                <div className="w-full bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <AudioLines className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Speaker Notes</span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed italic">"{slide.notes}"</p>
                </div>
              )}
            </div>
          </div>
        );
      } catch (err) {
        console.error("Slide Parse Error:", err);
      }
    }
    if (studioContent.type === 'flashcards') {
      try {
        const match = studioContent.content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        const rawJson = match ? match[0] : studioContent.content.replace(/```json|```/gi, '').trim();
        const cards = JSON.parse(rawJson);
        const idx = Math.min(currentCardIndex, cards.length - 1);
        const card = cards[idx];
        const isFlipped = !!flippedCards[idx];
        return (
          <div className="flex flex-col items-center gap-6 max-w-xl mx-auto py-4">
            {/* Progress */}
            <div className="flex items-center gap-2 w-full">
              {cards.map((_: any, i: number) => (
                <div key={i} className={cn("h-1 flex-1 rounded-full transition-all", i === idx ? "bg-indigo-500" : flippedCards[i] ? "bg-indigo-500/30" : "bg-white/10")} />
              ))}
            </div>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{idx + 1} / {cards.length}</p>

            {/* Flip Card */}
            <div
              onClick={() => setFlippedCards(prev => ({ ...prev, [idx]: !prev[idx] }))}
              className="cursor-pointer w-full"
              style={{ perspective: '1200px' }}
            >
              <div style={{ transition: 'transform 0.55s cubic-bezier(0.4,0.2,0.2,1)', transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)', position: 'relative', minHeight: '280px', width: '100%' }}>
                {/* Front */}
                <div style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}
                  className="bg-white/[0.03] border border-white/10 hover:border-indigo-500/30 rounded-3xl p-10 flex flex-col justify-between transition-colors">
                  <span className="text-[9px] font-bold text-indigo-400/60 uppercase tracking-widest">Question</span>
                  <p className="text-2xl font-bold text-white leading-snug text-center">{card.front}</p>
                  <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest text-center">Tap to reveal answer →</span>
                </div>
                {/* Back */}
                <div style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0, transform: 'rotateY(180deg)' }}
                  className="bg-indigo-500/10 border-2 border-indigo-500/30 rounded-3xl p-10 flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-indigo-400/80 uppercase tracking-widest">Answer</span>
                  <p className="text-xl font-semibold text-indigo-100 leading-snug text-center">{card.back}</p>
                  <span className="text-[9px] font-bold text-indigo-500/40 uppercase tracking-widest text-center">← Tap to flip back</span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setCurrentCardIndex(i => Math.max(0, i - 1)); setFlippedCards(prev => ({ ...prev })); }}
                disabled={idx === 0}
                className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-slate-400 font-bold text-sm hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >← Prev</button>
              <button
                onClick={() => { setCurrentCardIndex(i => Math.min(cards.length - 1, i + 1)); setFlippedCards(prev => ({ ...prev })); }}
                disabled={idx === cards.length - 1}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >Next →</button>
            </div>
          </div>
        );
      } catch (err) {}
    }

    return (
      <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
        {studioContent.content}
      </pre>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#0F1113] relative overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-display font-semibold text-white">Studio</h2>
        <button className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400">
          <Layout className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-8 scrollbar-hide">
        {/* Studio Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {tools.map(tool => (
            <button 
              key={tool.id}
              onClick={() => useStudioTool(tool.id)}
              disabled={isGeneratingStudioContent}
              className="p-3 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/[0.08] hover:border-white/10 transition-all group flex flex-col items-start gap-3 relative"
            >
              <div className="flex items-center justify-between w-full">
                <tool.icon className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400 transition-colors" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tool.label}</span>
                {tool.beta && (
                  <span className="px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[8px] font-bold text-indigo-400 uppercase tracking-tighter shadow-sm shadow-indigo-500/10">BETA</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Generated Things List */}
        <div className="space-y-4">
          <div className="h-px bg-white/5 w-full" />
          <div className="space-y-1">
            {isGeneratingStudioContent && (
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-[2rem] flex items-center gap-4 animate-pulse">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Generating Studio Output...</p>
              </div>
            )}
            
            {notes.map(note => {
              const Icon = getNoteIcon(note.type || 'report');
              const isAudio = note.type === 'audio';
              const isCurrentPlaying = playingNoteId === note.id && isTtsSpeaking;

              return (
                <div 
                  key={note.id}
                  onClick={() => {
                    if (isAudio) handlePlayAudio(note);
                    setStudioContent({ type: note.type || 'note', content: note.content });
                  }}
                  className={cn(
                    "group flex items-center gap-4 p-4 hover:bg-white/5 rounded-[2rem] transition-all cursor-pointer border border-transparent hover:border-white/5",
                    isCurrentPlaying && "bg-white/[0.03] border-white/5"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-slate-500 group-hover:text-white transition-all shadow-inner shadow-black/20",
                    isCurrentPlaying && "text-indigo-400 border-indigo-500/20"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-300 truncate group-hover:text-white transition-colors capitalize">
                      {note.content.split('\n')[0].replace(/^Title: |Generated |:/gi, '') || 'Generated Content'}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">
                      {note.type || 'Studio Output'} • {note.sourceCount || sources.length} sources • {formatTimeAgo(note.createdAt)}
                      {isCurrentPlaying && (
                        <span className="text-indigo-400 ml-2 animate-pulse">
                          • {isOnline ? 'Cloud TTS' : 'Offline Mode'}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAudio && (
                      <>
                        {isCurrentPlaying && (
                          <div className="p-1 px-2 text-indigo-500 transition-all animate-pulse">
                            <Waves className="w-4 h-4" />
                          </div>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); handlePlayAudio(note); }}
                          className={cn(
                            "p-2 rounded-xl transition-all shadow-sm",
                            isCurrentPlaying 
                              ? "bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white" 
                              : "bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white"
                          )}
                        >
                          {isCurrentPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            stop(); // Stop background audio IMMEDIATELY before starting tutor
                            setIsInteractiveModeOpen(note.content); 
                          }}
                          className="p-2 hover:bg-indigo-600/20 rounded-xl text-indigo-400 hover:text-white transition-all transform hover:translate-x-1"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {!isAudio && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setStudioContent({ type: note.type || 'note', content: note.content }); }}
                        className="p-2 hover:bg-white/10 rounded-xl text-slate-600 hover:text-white transition-all transform hover:translate-x-1"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                    <div className="relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveDropdownId(activeDropdownId === note.id ? null : note.id); }}
                        className="p-2 hover:bg-white/10 rounded-xl text-slate-600 hover:text-white transition-all"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {activeDropdownId === note.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-[#1E1F22] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                          {isAudio && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                handleDownloadAudio(note.content, note.id); 
                                setActiveDropdownId(null); 
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-indigo-400 hover:bg-indigo-500/10 flex items-center gap-2 transition-all font-medium"
                            >
                              <Download className="w-4 h-4" />
                              Download Audio
                            </button>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeNote(currentNotebookId!, note.id); setActiveDropdownId(null); }}
                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors font-medium"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Note
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {notes.length === 0 && !isGeneratingStudioContent && (
              <div className="py-20 text-center space-y-4 opacity-10">
                <Sparkles className="w-12 h-12 text-slate-700 mx-auto" />
                <p className="text-xs font-bold text-slate-600 uppercase tracking-[0.3em]">No studio outputs yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {studioContent && (
        <div className="fixed inset-0 z-[250] flex justify-center p-8 bg-slate-950/80 backdrop-blur-md overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-4xl bg-[#121316] border border-white/10 rounded-3xl flex flex-col shadow-2xl relative"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white uppercase tracking-widest">{studioContent.type} output</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-xl transition-all font-bold text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button 
                onClick={() => { 
                  setStudioContent(null); 
                  setQuizAnswers({});
                  setShowQuizResults(false);
                }} 
                className="p-2 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-colors"
              >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-8 relative">
              {renderStudioContent()}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
