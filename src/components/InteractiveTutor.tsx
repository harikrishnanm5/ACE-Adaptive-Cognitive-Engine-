import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, X, Loader2, Volume2, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { stripMarkdown } from '../lib/text';
import { useAIServices } from '../hooks/useAIServices';
import { useTTS } from '../hooks/useTTS';

interface InteractiveTutorProps {
  onClose: () => void;
  notebookId: string | null;
  sources: { name: string; content: string }[];
  userName: string;
  initialContent?: string;
  aiProvider: 'local' | 'cloud';
}

export default function InteractiveTutor({ onClose, notebookId, sources, userName, initialContent, aiProvider }: InteractiveTutorProps) {
  const { groqChatCompletion, lmStudioChatCompletion } = useAIServices();
  const { speak, stop: stopTts, isSpeaking: isTtsSpeaking } = useTTS();
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const hasGreetedRef = useRef(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');

  const stopListening = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsListening(false);
  }, []);

  const getAIResponse = async (userInput: string, forceGuidedContext?: string) => {
    setIsProcessing(true);
    setAiResponse('');
    
    try {
      const sourceContext = sources.map(s => `Source: ${s.name}\nContent: ${s.content}`).join('\n\n');
      const messages = [
        { 
          role: "system", 
          content: `You are ACE (Adaptive Cognitive Engine), an interactive AI tutor. 
          User's name: ${userName}. 
          Context from sources: ${sourceContext}.
          ${forceGuidedContext ? `SPECIAL CONTEXT (Guided Mode): ${forceGuidedContext}. Explain these concepts proactively.` : ''}
          Your task: Have a natural, conversation-based teaching session. 
          Keep responses concise (max 3-4 sentences) and highly engaging for voice conversation. 
          Encourage the user to ask questions.` 
        }
      ];

      if (userInput) {
        messages.push({ role: "user", content: userInput });
      } else if (forceGuidedContext) {
        // Much shorter, more reactive proactive prompt
        messages.push({ role: "user", content: "I've just listened to the audio overview. Greet me briefly and ask how you can help clarify these specific concepts." });
      }

      // Use Selected Provider (Local vs Cloud)
      let response = "";
      try {
        if (aiProvider === 'local') {
          const completion = await lmStudioChatCompletion(messages);
          response = completion.choices[0]?.message?.content || "";
        } else {
          const completion = await groqChatCompletion(messages, "llama-3.1-8b-instant");
          response = completion.choices[0]?.message?.content || "";
        }
      } catch (err) {
        console.error("AI Error:", err);
        response = aiProvider === 'local' 
          ? "Local AI is currently offline. Please ensure LM Studio is running on localhost 1234." 
          : "Cloud AI hit a rate limit. Please switch to Local in the chat header.";
      }

      if (!response) throw new Error("No AI response");
      
      const cleanResponse = stripMarkdown(response);
      setAiResponse(cleanResponse);
      // Start talking and listen automatically when done
      await speak(cleanResponse, () => {
        if (onClose) toggleListening();
      });
    } catch (err) {
      console.error('AI Error:', err);
      setAiResponse("I'm having trouble connecting to my brain right now.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleListening = async () => {
    if (isTtsSpeaking || isProcessing) {
      stopTts();
      setIsProcessing(false);
      setAiResponse('');
    }

    if (isListening) {
      stopListening();
      return;
    }

    try {
      setTranscript('');
      accumulatedTranscriptRef.current = '';
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const dgUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true`;
      const socket = new WebSocket(dgUrl, ['token', process.env.DEEPGRAM_API_KEY!]);

      socket.onopen = () => {
        setIsListening(true);
        mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0 && socket.readyState === 1) {
            socket.send(event.data);
          }
        });
        mediaRecorder.start(250);
      };

      socket.onmessage = (message) => {
        const data = JSON.parse(message.data);
        const transcriptText = data.channel?.alternatives?.[0]?.transcript;
        
        if (transcriptText) {
          setTranscript(transcriptText);
          
          if (data.is_final) {
            accumulatedTranscriptRef.current += ' ' + transcriptText;
          }

          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
          
          silenceTimeoutRef.current = setTimeout(() => {
            const finalInput = accumulatedTranscriptRef.current.trim();
            if (finalInput) {
              stopListening();
              getAIResponse(finalInput);
              accumulatedTranscriptRef.current = '';
            }
          }, 2000);
        }
      };

      socketRef.current = socket;
    } catch (err) {
      console.error('Mic Error:', err);
      setIsListening(false);
    }
  };

  // Clean up on unmount - force stop everything immediately
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.cancel();
      stopTts();
      stopListening();
    };
  }, [stopTts, stopListening]);

  // Proactive start effect
  useEffect(() => {
    if (!hasStarted) {
      setHasStarted(true);
      
      // Stop background audio IMMEDIATELY
      window.dispatchEvent(new CustomEvent('ace-stop-audio'));
      
      if (hasGreetedRef.current) return;
      hasGreetedRef.current = true;

      if (initialContent) {
        getAIResponse('', initialContent);
      } else if (sources.length > 0) {
        getAIResponse("Hi! Can you give me a quick welcome and introduce these concepts based on my notebook?");
      } else {
        const welcome = `Hi ${userName}, I'm ACE. Add some sources to your notebook so we can start our interactive lesson!`;
        setAiResponse(welcome);
        speak(welcome);
      }
    }
  }, [hasStarted, initialContent, userName, sources.length]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center p-8"
    >
      <button 
        onClick={onClose}
        className="absolute top-8 right-8 p-3 hover:bg-white/5 rounded-2xl text-slate-400 transition-all"
      >
        <X className="w-8 h-8" />
      </button>

      <div className="max-w-3xl w-full flex flex-col items-center space-y-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className={cn(
              "absolute inset-0 blur-3xl rounded-full transition-all duration-1000",
              isTtsSpeaking ? "bg-red-500/30 scale-150 opacity-100" : 
              (isListening ? "bg-blue-500/30 scale-150 opacity-100" : "bg-indigo-500/20 scale-100 opacity-0")
            )} />
            <div className={cn(
              "relative w-40 h-40 rounded-[3rem] border border-white/10 flex items-center justify-center shadow-2xl transition-all duration-500 bg-slate-900",
              isTtsSpeaking && "border-red-500/50 scale-105 shadow-red-500/20",
              isListening && "border-blue-500/50 scale-105 shadow-blue-500/20"
            )}>
              {isProcessing ? (
                <Loader2 className="w-16 h-16 text-indigo-400 animate-spin" />
              ) : (
                <Brain className={cn(
                  "w-16 h-16 transition-all duration-500",
                  isTtsSpeaking ? "text-red-400" : (isListening ? "text-blue-400" : "text-slate-700")
                )} />
              )}
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-3xl font-display font-bold text-white tracking-tight">ACE Conversational Tutor</h2>
            <p className={cn(
              "font-bold uppercase tracking-widest text-xs mt-2 transition-colors",
              isTtsSpeaking ? "text-red-400" : (isListening ? "text-blue-400" : "text-indigo-400")
            )}>
              {isTtsSpeaking ? 'AI Explaining concepts...' : (isListening ? 'Listening to you...' : 'Interactive Mode Active')}
            </p>
          </div>
        </div>

        <div className="w-full space-y-8 min-h-[200px] flex flex-col items-center justify-center text-center px-4">
          <AnimatePresence mode="wait">
            {transcript && (
              <motion.div 
                key={transcript}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-white/5 rounded-3xl border border-white/5 max-w-xl"
              >
                <p className="text-slate-400 text-lg leading-relaxed italic">"{transcript}"</p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {aiResponse && (
              <motion.div 
                key={aiResponse}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "p-8 border rounded-[2.5rem] shadow-2xl max-w-2xl transition-colors",
                  isTtsSpeaking ? "bg-red-500/5 border-red-500/20" : "bg-indigo-600/10 border-indigo-500/20"
                )}
              >
                <p className="text-xl font-medium text-white leading-relaxed">{aiResponse}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-8">
          <button 
            onClick={toggleListening}
            disabled={isProcessing}
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-2xl disabled:opacity-50",
              isListening ? "bg-blue-500 text-white animate-pulse shadow-blue-500/40" : 
              (isTtsSpeaking ? "bg-red-500 text-white animate-pulse shadow-red-500/40" : 
              "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/20")
            )}
          >
            <Mic className="w-8 h-8" />
          </button>
          
          {isTtsSpeaking && (
            <button 
              onClick={stopTts}
              className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-300 transition-all border border-red-500/20"
            >
              <Volume2 className="w-6 h-6 text-red-400" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
