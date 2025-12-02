import { useState, useEffect, useRef, useCallback } from 'react';

interface TextToSpeechResult {
  isSpeaking: boolean;
  isPaused: boolean;
  speak: (text: string) => void;
  pause: () => void;
  stop: () => void;
  hasSupport: boolean;
  // Extended controls
  voices: SpeechSynthesisVoice[];
  selectedVoiceName: string | null;
  setSelectedVoiceName: (name: string) => void;
  rate: number;
  setRate: (r: number) => void;
  pitch: number;
  setPitch: (p: number) => void;
}

export const useTextToSpeech = (): TextToSpeechResult => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | null>(() => {
    try { return localStorage.getItem('ttsVoice') || null; } catch { return null; }
  });
  // Slightly slower rate can sound more natural; leave pitch neutral
  const [rate, setRate] = useState<number>(0.95);
  const [pitch, setPitch] = useState<number>(1.0);

  const hasSupport = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const handleEnd = useCallback(() => {
    setIsSpeaking(false);
    setIsPaused(false);
    utteranceRef.current = null;
  }, []);

  // This effect is responsible for engine warm-up and cleanup on unmount.
  useEffect(() => {
    if (!hasSupport) return;

    // "Warm up" the speech synthesis engine by getting the voices list.
    // This helps prevent issues on some browsers where the engine is not ready.
    const warmUp = () => {
        if(window.speechSynthesis.getVoices().length > 0) return;
        window.speechSynthesis.getVoices();
    };
    
    const collectVoices = () => {
      const list = window.speechSynthesis.getVoices();
      if (list && list.length) {
        setVoices(list);
        // If no explicit selection, try to pick a human-like default
        setSelectedVoiceName(prev => {
          if (prev) return prev;
          const preferred = pickHumanLikeVoice(list);
          return preferred?.name || null;
        });
      }
    };

    warmUp();
    collectVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      warmUp();
      collectVoices();
    };

    // Ensure speech is cancelled when the component unmounts
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [hasSupport]);

  const speak = (text: string) => {
    if (!hasSupport || !text) return;

    // If speaking, stop the current speech before starting a new one.
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    
    // Reset state immediately for better UI responsiveness
    setIsSpeaking(false);
    setIsPaused(false);

    const newUtterance = new SpeechSynthesisUtterance(text);
    // apply voice if available
    if (voices && voices.length) {
      const voice = voices.find(v => v.name === selectedVoiceName) || pickHumanLikeVoice(voices) || voices.find(v => v.default) || voices[0];
      if (voice) newUtterance.voice = voice;
    }
    newUtterance.rate = rate;
    newUtterance.pitch = pitch;
    utteranceRef.current = newUtterance;

    newUtterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    newUtterance.onpause = () => {
        setIsSpeaking(true);
        setIsPaused(true);
    };

    newUtterance.onresume = () => {
        setIsSpeaking(true);
        setIsPaused(false);
    };

    newUtterance.onend = handleEnd;

    newUtterance.onerror = (e) => {
      console.error("Speech synthesis error:", e);
      if (e.error) {
          console.error("Speech synthesis error code:", e.error);
      }
      handleEnd(); // Reset state on error too
    };

    // Use a small timeout to ensure the previous 'cancel' command has processed.
    setTimeout(() => {
      window.speechSynthesis.speak(newUtterance);
    }, 100);
  };

  const pause = () => {
    if (hasSupport && window.speechSynthesis.speaking && !isPaused) {
      window.speechSynthesis.pause();
    } else if (hasSupport && isPaused) {
      window.speechSynthesis.resume();
    }
  };

  const stop = () => {
    if (hasSupport && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel(); // 'onend' will fire and reset state.
    }
  };

  // Persist selected voice
  useEffect(() => {
    try {
      if (selectedVoiceName) localStorage.setItem('ttsVoice', selectedVoiceName);
    } catch {}
  }, [selectedVoiceName]);

  return { isSpeaking, isPaused, speak, pause, stop, hasSupport, voices, selectedVoiceName, setSelectedVoiceName, rate, setRate, pitch, setPitch };
};

// Heuristic to pick a more natural-sounding voice
function pickHumanLikeVoice(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const nameIncludes = (v: SpeechSynthesisVoice, s: string) => (v.name || '').toLowerCase().includes(s);
  const langScore = (v: SpeechSynthesisVoice) => (v.lang || '').toLowerCase().startsWith('en') ? 2 : 0;

  // Order of preference by name hints
  const prefer = ['natural', 'neural', 'google', 'microsoft', 'premium', 'studio'];
  let best: { score: number; v?: SpeechSynthesisVoice } = { score: -1 };
  for (const v of list) {
    let score = langScore(v);
    for (let i = 0; i < prefer.length; i++) {
      if (nameIncludes(v, prefer[i])) score += (prefer.length - i); // earlier keywords get higher weight
    }
    if (v.default) score += 1;
    if (score > best.score) best = { score, v };
  }
  return best.v;
}
