import { useEffect, useState } from 'react';
import { getRateLimitStatus } from '@/services/geminiService';

interface RateLimitState {
  coolingDown: boolean;
  resumeInMs: number;
  hits: number;
}

export function useRateLimitStatus(pollMs: number = 500): RateLimitState {
  const [state, setState] = useState<RateLimitState>(() => getRateLimitStatus());

  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      setState(getRateLimitStatus());
    };
    const id = setInterval(tick, pollMs);
    return () => { mounted = false; clearInterval(id); };
  }, [pollMs]);

  return state;
}
