import React, { useEffect, useState } from 'react';
import { isGeminiKeyAvailable, verifyApiKey } from '@/services/geminiService';

type Status = 'checking' | 'missing' | 'invalid' | 'valid';

const ApiKeyNotice: React.FC<{ onOpenSettings?: () => void }>
 = ({ onOpenSettings }) => {
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState<string>('');

  const runCheck = async () => {
    try {
      if (!isGeminiKeyAvailable()) {
        setStatus('missing');
        setMessage('Gemini API key is not set.');
        return;
      }
      setStatus('checking');
      const res = await verifyApiKey();
      if (res.valid) {
        setStatus('valid');
        setMessage('API key is valid.');
      } else {
        setStatus('invalid');
        setMessage(res.error || 'API key validation failed.');
      }
    } catch {
      setStatus('invalid');
      setMessage('API key validation failed.');
    }
  };

  useEffect(() => {
    runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'valid') return null;

  const bg = status === 'missing' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-200'
            : status === 'invalid' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-200'
            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';

  const handlePasteKey = async () => {
    try {
      const val = window.prompt('Paste your VITE_GEMINI_API_KEY');
      if (!val) return;
      localStorage.setItem('VITE_GEMINI_API_KEY', val.trim());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).VITE_GEMINI_API_KEY = val.trim();
      await runCheck();
    } catch {/* ignore */}
  };

  return (
    <div className={`mb-2 border rounded-lg px-3 py-2 text-sm flex items-start justify-between ${bg}`} role="alert" aria-live="polite">
      <div className="pr-2">
        <div className="font-semibold">
          {status === 'missing' && 'Gemini API key required'}
          {status === 'invalid' && 'Gemini API key invalid'}
          {status === 'checking' && 'Checking Gemini API key…'}
        </div>
        {message && <div className="text-xs opacity-90 mt-0.5 break-words max-w-prose">{message}</div>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {status !== 'checking' && (
          <button
            onClick={runCheck}
            className="px-2 py-1 text-xs rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
          >Re-test</button>
        )}
        {(status === 'missing' || status === 'invalid') && (
          <button
            onClick={handlePasteKey}
            className="px-2 py-1 text-xs rounded bg-violet-600 text-white hover:bg-violet-700"
          >Paste key</button>
        )}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="px-2 py-1 text-xs rounded bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90"
            title="Open Settings to manage keys"
          >Open Settings</button>
        )}
      </div>
    </div>
  );
};

export default ApiKeyNotice;
