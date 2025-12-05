import React, { useEffect, useState } from 'react';
import { isNvidiaConfigured, checkNvidiaHealth } from '@/services/nvidiaService';
import { isGrokConfigured, checkGrokHealth } from '@/services/grokService';

type Status = 'checking' | 'missing' | 'invalid' | 'valid';

const ApiKeyNotice: React.FC<{ onOpenSettings?: () => void }>
  = ({ onOpenSettings }) => {
    const [nvidiaStatus, setNvidiaStatus] = useState<Status>('checking');
    const [grokStatus, setGrokStatus] = useState<Status>('checking');
    const [message, setMessage] = useState<string>('');

    const runCheck = async () => {
      // Check NVIDIA
      if (!isNvidiaConfigured()) {
        setNvidiaStatus('missing');
      } else {
        setNvidiaStatus('checking');
        checkNvidiaHealth().then(res => {
          setNvidiaStatus(res.ok ? 'valid' : 'invalid');
        });
      }

      // Check Grok
      if (!isGrokConfigured()) {
        setGrokStatus('missing');
      } else {
        setGrokStatus('checking');
        checkGrokHealth().then(res => {
          setGrokStatus(res.ok ? 'valid' : 'invalid');
        });
      }
    };

    useEffect(() => {
      runCheck();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Determine overall state to show
    // Priority: Missing NVIDIA > Invalid NVIDIA > Missing Grok > Invalid Grok

    if (nvidiaStatus === 'valid' && grokStatus === 'valid') return null;

    // If we are still checking everything, show nothing or a subtle loader
    if (nvidiaStatus === 'checking' && grokStatus === 'checking') return null;

    let displayStatus: Status = 'valid';
    let displayTitle = '';
    let displayMsg = '';
    let targetProvider: 'nvidia' | 'grok' = 'nvidia';

    if (nvidiaStatus === 'missing') {
      displayStatus = 'missing';
      displayTitle = 'NVIDIA API key required';
      displayMsg = 'Required for Text, Chat, and Vision features.';
      targetProvider = 'nvidia';
    } else if (nvidiaStatus === 'invalid') {
      displayStatus = 'invalid';
      displayTitle = 'NVIDIA API key invalid';
      displayMsg = 'Please check your key in Settings.';
      targetProvider = 'nvidia';
    } else if (grokStatus === 'missing') {
      displayStatus = 'missing';
      displayTitle = 'xAI Grok API key recommended';
      displayMsg = 'Required for Image Generation. Fallback to Nemotron available but limited.';
      targetProvider = 'grok';
    } else if (grokStatus === 'invalid') {
      displayStatus = 'invalid';
      displayTitle = 'xAI Grok API key invalid';
      displayMsg = 'Image generation may fail. Please check your key.';
      targetProvider = 'grok';
    } else {
      return null;
    }

    const bg = displayStatus === 'missing' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-200'
      : displayStatus === 'invalid' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-200'
        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';

    const handlePasteKey = async () => {
      try {
        const keyName = targetProvider === 'nvidia' ? 'VITE_NVIDIA_API_KEY' : 'VITE_XAI_API_KEY';
        const val = window.prompt(`Paste your ${keyName}`);
        if (!val) return;
        localStorage.setItem(keyName, val.trim());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any)[keyName] = val.trim();
        await runCheck();
      } catch {/* ignore */ }
    };

    return (
      <div className={`mb-2 border rounded-lg px-3 py-2 text-sm flex items-start justify-between ${bg}`} role="alert" aria-live="polite">
        <div className="pr-2">
          <div className="font-semibold">
            {displayTitle}
          </div>
          <div className="text-xs opacity-90 mt-0.5 break-words max-w-prose">{displayMsg}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={runCheck}
            className="px-2 py-1 text-xs rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
          >Re-test</button>

          <button
            onClick={handlePasteKey}
            className={`px-2 py-1 text-xs rounded text-white ${targetProvider === 'nvidia' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >Paste key</button>

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
