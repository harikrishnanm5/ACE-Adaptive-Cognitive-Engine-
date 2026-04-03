import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, X, Loader2, Volume2, Sparkles, Brain, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Groq from 'groq-sdk';

interface InteractiveTutorProps {
  onClose: () => void;
  notebookId: string;
  sources: { name: string; content: string }[];
  userName: string;
}

const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY, 
  dangerouslyAllowBrowser: true 
});

export default function InteractiveTutor({ onClose, notebookId, sources, userName }: InteractiveTutorProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');

  const stopSpeaking = useCallback(() => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      audioSourceRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

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
    setIsListening(false);
  }, []);

  const speakText = async (text: string) => {
    if (!text || isSpeaking) return;
    
    stopSpeaking();
    setIsSpeaking(true);

    try {
      const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-asteria-en', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) throw new Error('TTS failed');

      const arrayBuffer = await response.arrayBuffer();
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setIsSpeaking(false);
        // Automatically start listening if the AI asked a question
        if (text.trim().endsWith('?')) {
          toggleListening();
        }
      };

      source.start(0);
      audioSourceRef.current = source;
    } catch (err) {
      console.error('TTS Error:', err);
      setIsSpeaking(false);
    }
  };

  const getAIResponse = async (userInput: string) => {
    setIsProcessing(true);
    setAiResponse('');
    
    try {
      if (sources.length === 0) {
        const noSourceMessage = "I'm ready to help, but your notebook is empty. Please add at least one source (like a document, URL, or video) so we can start our lesson!";
        setAiResponse(noSourceMessage);
        await speakText(noSourceMessage);
        setIsProcessing(false);
        return;
      }

      const sourceContext = sources.map(s => `Source: ${s.name}\nContent: ${s.content}`).join('\n\n');
      const completion = await groq.chat.completions.create({
        messages: [
          { 
            role: "system", 
            content: `You are ACE (Adaptive Cognitive Engine), an interactive AI tutor. 
            User's name: ${userName}. 
            Context from sources: ${sourceContext}.
            Your task: Have a natural, conversation-based teaching session. 
            Keep responses concise (max 3-4 sentences) and highly engaging for voice conversation. 
            Encourage the user to ask questions.` 
          },
          { role: "user", content: userInput }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that.";
      setAiResponse(response);
      await speakText(response);
    } catch (err) {
      console.error('AI Error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleListening = async () => {
    // If currently speaking or processing, an interruption occurred. 
    // We want to stop everything and start listening fresh.
    if (isSpeaking || isProcessing) {
      stopSpeaking();
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

          // Reset silence timeout
          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
          
          silenceTimeoutRef.current = setTimeout(() => {
            const finalInput = accumulatedTranscriptRef.current.trim();
            if (finalInput) {
              stopListening();
              getAIResponse(finalInput);
              accumulatedTranscriptRef.current = '';
            }
          }, 2000); // 2 seconds silence
        }
      };

      socketRef.current = socket;
    } catch (err) {
      console.error('Mic Error:', err);
      setIsListening(false);
    }
  };

  useEffect(() => {
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [stopListening, stopSpeaking]);

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
            <div className={`absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full transition-all duration-1000 ${isSpeaking || isListening ? 'scale-150 opacity-100' : 'scale-100 opacity-0'}`} />
            <div className={`relative w-40 h-40 rounded-[3rem] border border-white/10 flex items-center justify-center shadow-2xl transition-all duration-500 bg-slate-900 ${isSpeaking ? 'border-indigo-500/50 scale-105' : ''}`}>
              {isProcessing ? (
                <Loader2 className="w-16 h-16 text-indigo-400 animate-spin" />
              ) : (
                <Brain className={`w-16 h-16 transition-all duration-500 ${isSpeaking ? 'text-indigo-400' : 'text-slate-700'}`} />
              )}
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-3xl font-display font-bold text-white tracking-tight">ACE Conversational Tutor</h2>
            <p className="text-indigo-400 font-bold uppercase tracking-widest text-xs mt-2">Interactive Mode Active</p>
          </div>
        </div>

        <div className="w-full space-y-8 min-h-[200px] flex flex-col items-center justify-center text-center">
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
                className="p-8 bg-indigo-600/10 border border-indigo-500/20 rounded-[2.5rem] shadow-2xl max-w-2xl"
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
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-2xl disabled:opacity-50 ${isListening ? 'bg-red-500 text-white animate-pulse shadow-red-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/20'}`}
          >
            {isListening ? <MicOff className="w-8 h-8" /> : (isSpeaking ? <Zap className="w-8 h-8 animate-pulse" /> : <Mic className="w-8 h-8" />)}
          </button>
          
          {isSpeaking && (
            <button 
              onClick={stopSpeaking}
              className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-300 transition-all"
            >
              <Volume2 className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/5 rounded-xl">
            <Zap className="w-4 h-4 text-orange-400 shadow-lg shadow-orange-500/20" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Groq Llama 3</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/5 rounded-xl">
            <Sparkles className="w-4 h-4 text-blue-400 shadow-lg shadow-blue-500/20" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Deepgram Nova-2</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
