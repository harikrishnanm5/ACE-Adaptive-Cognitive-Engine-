import { useState, useCallback, useRef, useEffect } from 'react';
import { deepgramTTS } from './useAIServices';

export function useTTS(aiProvider: 'local' | 'cloud' = 'cloud') {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);
  const onEndedRef = useRef<(() => void) | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const stop = useCallback(() => {
    // Stop Deepgram/AudioContext
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) { }
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) { }
      audioContextRef.current = null;
    }
    // Force-stop Native SpeechSynthesis even if it thinks it's not speaking
    window.speechSynthesis.cancel();
    window.speechSynthesis.cancel(); // double-cancel to flush Chrome's queue
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Global Audio Synchronization listener
  useEffect(() => {
    const handleStopAll = () => stop();
    window.addEventListener('ace-stop-audio', handleStopAll);
    return () => window.removeEventListener('ace-stop-audio', handleStopAll);
  }, [stop]);

  const speak = useCallback(async (text: string, onEnded?: () => void) => {
    if (!text) return;
    onEndedRef.current = onEnded || null;

    // Globally stop all other AI voices before starting this one
    window.dispatchEvent(new CustomEvent('ace-stop-audio'));

    stop();
    setIsSpeaking(true);

    if (isOnline && process.env.DEEPGRAM_API_KEY && aiProvider === 'cloud') {
      try {
        const audioBlob = await deepgramTTS(text);
        const arrayBuffer = await audioBlob.arrayBuffer();
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }

        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);

        source.onended = () => {
          setIsSpeaking(false);
          if (onEndedRef.current) {
            onEndedRef.current();
            onEndedRef.current = null;
          }
        };

        source.start(0);
        audioSourceRef.current = source;
      } catch (err) {
        console.error('Deepgram TTS Error, falling back to local:', err);
        speakLocal(text, onEnded);
      }
    } else {
      speakLocal(text, onEnded);
    }
  }, [isOnline, stop, aiProvider]);

  const speakLocal = (text: string, onEnded?: () => void) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.lang === 'en-US');
    if (premiumVoice) utterance.voice = premiumVoice;

    utterance.onend = () => {
      setIsSpeaking(false);
      if (onEnded) onEnded();
    };
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      stop();
    };
  }, [stop]);

  return { speak, stop, isSpeaking, isOnline };
}
