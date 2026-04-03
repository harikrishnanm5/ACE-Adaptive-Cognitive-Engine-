import React from 'react';
import { 
  Brain, 
  Loader2, 
  Sparkles, 
  HelpCircle, 
  Network,
  Settings2,
  MoreVertical,
  ChevronRight,
  Clipboard,
  ThumbsUp,
  ThumbsDown,
  StickyNote,
  ArrowUp,
  Download
} from 'lucide-react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { jsPDF } from 'jspdf';
import { cn } from '../lib/utils';
import { User } from '../hooks/useAuth';
import { ChatMessage } from '../hooks/useNotebook';

interface ChatContainerProps {
  chatMessages: ChatMessage[];
  user: User;
  isLoading: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  input: string;
  setInput: (input: string) => void;
  handleSendMessage: () => Promise<void>;
  sourcesCount: number;
  aiProvider: 'local' | 'cloud';
  setAiProvider: (provider: 'local' | 'cloud') => void;
}

const AISwitcher: React.FC<{ provider: 'local' | 'cloud', onChange: (p: 'local' | 'cloud') => void }> = ({ provider, onChange }) => {
  const isLocal = provider === 'local';
  const isOnline = navigator.onLine;

  return (
    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1 relative overflow-hidden group">
      <div 
        className={cn(
          "absolute inset-y-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out",
          isLocal ? "left-1 bg-emerald-500/20" : "left-[calc(50%+4px)] bg-indigo-500/20"
        )} 
      />
      
      <button 
        onClick={() => onChange('local')}
        className={cn(
          "relative z-10 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors",
          isLocal ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"
        )}
      >
        <Network className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Local</span>
      </button>

      <button 
        onClick={() => isOnline && onChange('cloud')}
        disabled={!isOnline}
        className={cn(
          "relative z-10 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors",
          !isLocal ? "text-indigo-400" : "text-slate-500 hover:text-slate-300",
          !isOnline && "opacity-30 cursor-not-allowed"
        )}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Cloud</span>
      </button>

      {!isOnline && (
        <div className="absolute right-2 text-[8px] font-black text-red-500/50 uppercase pointer-events-none">OFF</div>
      )}
    </div>
  );
};

export const ChatContainer: React.FC<ChatContainerProps> = ({
  chatMessages,
  input,
  setInput,
  handleSendMessage,
  isLoading,
  chatEndRef,
  sourcesCount,
  aiProvider,
  setAiProvider
}) => {
  const handleDownloadPDF = (content: string) => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.setTextColor(30, 30, 30);
      doc.text("ACE Artificial Intelligence - Output Export", 20, 20);
      
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      
      // Strip complicated characters that may break standard jsPDF fonts
      const safeContent = content.replace(/[^\x20-\x7E\r\n]/g, '');
      const splitText = doc.splitTextToSize(safeContent, 170);
      
      let cursorY = 30;
      splitText.forEach((line: string) => {
        if (cursorY > 280) {
          doc.addPage();
          cursorY = 20;
        }
        doc.text(line, 20, cursorY);
        cursorY += 6;
      });
      
      doc.save(`ACE_Chat_Export_${Date.now()}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Error generating PDF.");
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0F1113] border-r border-white/5 relative">
      {/* Header */}
      <div className="p-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-display font-semibold text-white">Chat</h2>
          <AISwitcher provider={aiProvider} onChange={setAiProvider} />
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500">
            <Settings2 className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-12 scrollbar-hide">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-20">
            <Brain className="w-16 h-16 text-slate-600" />
            <p className="text-sm font-medium text-slate-500">Ask ACE anything about your sources.</p>
          </div>
        ) : (
          <>
            {chatMessages.map((msg, i) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl max-w-[80%]">
                      <p className="text-sm text-slate-300 font-medium">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 text-left">
                    <div className="prose prose-invert prose-sm max-w-none prose-p:text-slate-300 prose-p:leading-relaxed prose-p:my-2 prose-strong:text-white prose-headings:text-indigo-300 prose-headings:font-bold prose-ul:text-slate-300 prose-ol:text-slate-300 prose-li:my-0.5 prose-code:text-indigo-300 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    
                    <div className="flex items-center gap-4 pt-4 border-t border-white/[0.03]">
                      <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-bold text-slate-400 transition-all uppercase tracking-wider">
                        <StickyNote className="w-3.5 h-3.5" />
                        Save to note
                      </button>
                      <div className="h-4 w-px bg-white/10" />
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleDownloadPDF(msg.content)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500 border border-indigo-500/10 rounded-xl text-[10px] font-bold text-indigo-400 hover:text-white transition-all uppercase tracking-wider mr-2"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                        <button className="p-2 hover:bg-white/5 rounded-lg text-slate-500 transition-all">
                          <Clipboard className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-white/5 rounded-lg text-slate-500 transition-all">
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-white/5 rounded-lg text-slate-500 transition-all">
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
            {isLoading && (
              <div className="flex gap-4 items-center">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                <p className="text-xs font-bold text-slate-600 uppercase tracking-[0.2em]">ACE is thinking...</p>
              </div>
            )}
            <div ref={chatEndRef as any} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 shrink-0 relative">
        <div className="max-w-4xl mx-auto">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-[2rem] blur opacity-25 group-focus-within:opacity-100 transition-opacity" />
            <div className="relative bg-[#1E1F22] border border-white/10 rounded-[2rem] p-2 flex items-end gap-2 shadow-2xl">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Start typing..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 px-4 min-h-[48px] max-h-[200px] resize-none text-white placeholder:text-slate-600"
                rows={1}
              />
              <div className="flex items-center gap-2 p-1">
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{sourcesCount} sources</span>
                </div>
                <button 
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading}
                  className="p-3 bg-white/5 border border-white/5 text-slate-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 rounded-2xl transition-all disabled:opacity-50"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
