import { useState } from 'react';

interface RateLimitState {
  coolingDown: boolean;
  resumeInMs: number;
  hits: number;
}

export function useRateLimitStatus(pollMs: number = 500): RateLimitState {
  // Mock implementation as Gemini service is removed
  // TODO: Implement Nemotron rate limiting if needed
  return {
    coolingDown: false,
    resumeInMs: 0,
    hits: 0
  };
}
