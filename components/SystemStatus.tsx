import React, { useMemo, useState } from 'react';
import ActivityViewer from '@/components/ActivityViewer';
import { verifyApiKey, generateRobustImage, getRateLimitStatus, checkAllApis } from '@/services/geminiService';

const services = [
  { name: 'AI Model API (Gemini)', status: 'Operational', description: 'All systems are functioning normally.' },
  { name: 'Image Generation Service', status: 'Operational', description: 'Image processing and generation are stable.' },
  { name: 'Chat Service', status: 'Operational', description: 'Real-time messaging is fully operational.' },
  { name: 'Application UI', status: 'Operational', description: 'The user interface and all components are responsive.' },
  { name: 'History & Caching', status: 'Operational', description: 'Local storage and session history are working correctly.' },
];

const incidents = [
    { date: 'July 26, 2024', time: '10:30 AM PST', title: 'Resolved: Minor Latency in Image Generation', description: 'The issue with image generation latency has been resolved. All services are back to normal performance levels.' },
    { date: 'July 26, 2024', time: '10:00 AM PST', title: 'Investigating: Minor Latency in Image Generation', description: 'We are currently investigating reports of minor latency with the Image Generation feature. Other services remain unaffected.' },
];

const getStatusIndicatorClasses = (status: string) => {
    switch (status) {
        case 'Operational':
            return {
                dot: 'bg-green-500',
                text: 'text-green-700 dark:text-green-300',
                bg: 'bg-green-50 dark:bg-green-900/30'
            };
        case 'Degraded Performance':
             return {
                dot: 'bg-yellow-500',
                text: 'text-yellow-700 dark:text-yellow-300',
                bg: 'bg-yellow-50 dark:bg-yellow-900/30'
            };
        case 'Major Outage':
            return {
                dot: 'bg-red-500',
                text: 'text-red-700 dark:text-red-300',
                bg: 'bg-red-50 dark:bg-red-900/30'
            };
        default:
            return {
                dot: 'bg-slate-500',
                text: 'text-slate-700 dark:text-slate-300',
                bg: 'bg-slate-50 dark:bg-slate-800/50'
            };
    }
};

const SystemStatus: React.FC = () => {
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [imageTestStatus, setImageTestStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [imageTestResults, setImageTestResults] = useState<Array<{label: string; provider?: string; success: boolean; note?: string; error?: string}>>([]);
  // Hugging Face token management moved here from ImageGeneration
  const [hfTokenInput, setHfTokenInput] = useState('');
  const [hfTokenSaved, setHfTokenSaved] = useState<string | null>(() => {
    try { return localStorage.getItem('VITE_HF_API_TOKEN'); } catch { return null; }
  });
  const [showHFManager, setShowHFManager] = useState(false);
  // Composite check banner state
  const [allCheckBusy, setAllCheckBusy] = useState(false);
  const [allCheckMsg, setAllCheckMsg] = useState<string | null>(null);
  const [allCheckOk, setAllCheckOk] = useState<boolean | null>(null);
  // Gemini key manager (runtime injection)
  const [showKeyManager, setShowKeyManager] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyDetectedFrom, setKeyDetectedFrom] = useState<Array<'vite' | 'window' | 'localStorage'>>(() => {
    const sources: Array<'vite' | 'window' | 'localStorage'> = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const envAny = (import.meta as any);
      if (envAny?.env?.VITE_GEMINI_API_KEY) sources.push('vite');
      if (typeof window !== 'undefined' && (window as any)?.VITE_GEMINI_API_KEY) sources.push('window');
      if (typeof window !== 'undefined' && window.localStorage?.getItem('VITE_GEMINI_API_KEY')) sources.push('localStorage');
    } catch {}
    return sources;
  });
  const [lastVerifyAt, setLastVerifyAt] = useState<string | null>(null);
  const [lastVerifyMs, setLastVerifyMs] = useState<number | null>(null);

  // Detect presence of a key without revealing it
  const apiKeyPresent = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const envAny = import.meta as any;
      const viteKey = envAny?.env?.VITE_GEMINI_API_KEY as string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const winKey = (typeof window !== 'undefined' ? (window as any)?.VITE_GEMINI_API_KEY : undefined) as string | undefined;
      const lsKey = (typeof window !== 'undefined' ? window.localStorage?.getItem('VITE_GEMINI_API_KEY') ?? undefined : undefined);
      return Boolean(viteKey || winKey || lsKey);
    } catch {
      return false;
    }
  }, []);

  const handleVerify = async () => {
    setApiKeyStatus('checking');
    setApiKeyError(null);
    const t0 = performance.now();
    const res = await verifyApiKey();
    const ms = Math.round(performance.now() - t0);
    setLastVerifyMs(ms);
    setLastVerifyAt(new Date().toLocaleString());
    if (res.valid) {
      setApiKeyStatus('valid');
    } else {
      setApiKeyStatus('invalid');
      setApiKeyError(res.error ?? 'Unknown error');
    }
  };

  // simple sleep helper for self-test pacing
  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  const runImageFallbackSelfTest = async () => {
    setImageTestStatus('running');
    setImageTestResults([]);
    const cases: Array<{label: string; preferred: 'imagen-4.0-generate-001' | 'gemini-2.5-flash-image'}> = [
      { label: 'Preferred: Imagen', preferred: 'imagen-4.0-generate-001' },
      { label: 'Preferred: Nano', preferred: 'gemini-2.5-flash-image' }
    ];
    const results: Array<{label: string; provider?: string; success: boolean; note?: string; error?: string}> = [];
    for (const c of cases) {
      // If global cooldown active, wait before firing next provider test
      const status = getRateLimitStatus();
      if (status.coolingDown) {
        // Add ~150ms buffer after cooldown end
        await sleep(status.resumeInMs + 150);
      }
      try {
        // Short, neutral prompt keeps cost minimal and avoids safety blocks.
        const resp = await generateRobustImage('minimal test icon', 'none', '1:1', c.preferred);
        // provider/note may be on resp; cast to any to avoid over-fitting types
        const provider = (resp as any).provider as string | undefined;
        const note = (resp as any).note as string | undefined;
        results.push({ label: c.label, provider, success: resp.success, note, error: resp.success ? undefined : resp.error });
        // If this attempt triggered rate limit (parseError embeds RATE_LIMIT:), pause before next
        if (!resp.success && (resp.error || '').includes('RATE_LIMIT:')) {
          const after = getRateLimitStatus();
          if (after.coolingDown) await sleep(after.resumeInMs + 200);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ label: c.label, success: false, error: msg });
      }
    }
    setImageTestResults(results);
    setImageTestStatus('done');
  };

  // Reflect saved HF token to window for service fallback logic
  React.useEffect(() => {
    if (hfTokenSaved) {
      (window as any).VITE_HF_API_TOKEN = hfTokenSaved;
    } else {
      delete (window as any).VITE_HF_API_TOKEN;
    }
  }, [hfTokenSaved]);

  return (
    <div className="h-full flex flex-col p-1 sm:p-4 overflow-y-auto">
      <header className="mb-6 px-3 sm:px-0 flex-shrink-0">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">System Status</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Current status of FANTOM AI services and recent incidents.
        </p>
      </header>

      {/* API Key & Provider Tokens */}
  <div className="bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg p-4 sm:p-6 mb-6">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
          <div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Gemini API Key</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Verify that your API key is present and can make a minimal request.</p>
          </div>
          {/* Compact action bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Key status pill */}
            <button
              type="button"
              onClick={() => setShowKeyManager(v => !v)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full border shadow-sm transition ${apiKeyPresent ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50'}`}
              aria-label={apiKeyPresent ? 'No key missing (manage key)' : 'Key missing (manage key)'}
              title="Toggle Gemini key manager"
            >
              <span className={`w-2.5 h-2.5 rounded-full ${apiKeyPresent ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {apiKeyPresent ? 'No key missing' : 'Key missing'}
            </button>
            {/* Verify now */}
            <button
              type="button"
              onClick={handleVerify}
              disabled={!apiKeyPresent || apiKeyStatus === 'checking'}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full border shadow-sm transition ${apiKeyPresent ? 'bg-violet-600 hover:bg-violet-700 text-white border-violet-700' : 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed'}`}
              aria-label="Verify Gemini API key"
              title="Verify Gemini API key"
            >
              {apiKeyStatus === 'checking' && (
                <span className="w-3.5 h-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
              )}
              {apiKeyStatus === 'idle' && 'Verify now'}
              {apiKeyStatus === 'checking' && 'Verifying…'}
              {apiKeyStatus === 'valid' && 'Verified'}
              {apiKeyStatus === 'invalid' && 'Retry verify'}
            </button>
            {/* Image fallback test */}
            <button
              type="button"
              onClick={runImageFallbackSelfTest}
              disabled={imageTestStatus === 'running'}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full border shadow-sm transition ${imageTestStatus === 'running' ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed' : 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700 hover:bg-violet-100 dark:hover:bg-violet-800/40'}`}
              aria-label="Run image fallback self-test"
              title="Run image fallback self-test"
            >
              {imageTestStatus === 'running' && (
                <span className="w-3.5 h-3.5 border-2 border-violet-500/60 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
              )}
              {imageTestStatus === 'idle' && 'Image fallback test'}
              {imageTestStatus === 'running' && 'Testing…'}
              {imageTestStatus === 'done' && 'Retest image fallback'}
            </button>
            {/* Manage HF token */}
            <button
              type="button"
              onClick={() => setShowHFManager(v => !v)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full border shadow-sm transition ${showHFManager ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300' : 'bg-violet-600 hover:bg-violet-700 text-white border-violet-700'}`}
              title="Toggle Hugging Face token manager"
            >{showHFManager ? 'Hide HF token' : 'Manage HF token'}</button>
            {/* Check all APIs */}
            <button
              type="button"
              onClick={async () => {
                setAllCheckBusy(true);
                setAllCheckMsg(null);
                try {
                  const res = await checkAllApis();
                  setAllCheckOk(res.ok);
                  setAllCheckMsg(res.message);
                } finally {
                  setAllCheckBusy(false);
                }
              }}
              disabled={allCheckBusy}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full border shadow-sm transition ${allCheckBusy ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'}`}
              aria-label="Check all APIs"
              title="Check all APIs"
            >
              {allCheckBusy && <span className="w-3.5 h-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>}
              {allCheckBusy ? 'Checking…' : "Check all APIs"}
            </button>
          </div>
        </div>

        {apiKeyStatus === 'valid' && (
          <div className="mt-4 p-3 rounded-md bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-300" role="status">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">API key is valid and responding.</span>
              {lastVerifyMs != null && <span className="text-xs">Latency: {lastVerifyMs}ms</span>}
              {lastVerifyAt && <span className="text-xs opacity-70">Last check: {lastVerifyAt}</span>}
            </div>
          </div>
        )}
        {allCheckMsg && (
          <div className={`mt-4 p-3 rounded-md border ${allCheckOk ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'}`} role="status">
            {allCheckMsg}
          </div>
        )}
        {apiKeyStatus === 'invalid' && (
          <div className="mt-4 p-3 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300" role="alert">
            <p className="font-medium">Verification failed.</p>
            {apiKeyError && <p className="text-sm mt-1">{apiKeyError}</p>}
          </div>
        )}
        {showKeyManager && (
          <div className="mt-6 border-t pt-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Gemini API Key</h4>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-violet-600 dark:text-violet-300 hover:underline">Get a key</a>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">We never send your key anywhere except directly to Google’s API from your browser. You can set it at runtime or in a .env.local file.</p>
            <div className="mt-3 flex flex-col gap-2 max-w-md">
              <input
                type="password"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value.trim())}
                placeholder="Paste VITE_GEMINI_API_KEY"
                className="p-2 text-sm rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={!keyInput}
                  onClick={() => {
                    try {
                      localStorage.setItem('VITE_GEMINI_API_KEY', keyInput);
                      (window as any).VITE_GEMINI_API_KEY = keyInput;
                      setKeyInput('');
                      const sources: Array<'vite' | 'window' | 'localStorage'> = [];
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const envAny = (import.meta as any);
                      if (envAny?.env?.VITE_GEMINI_API_KEY) sources.push('vite');
                      if ((window as any)?.VITE_GEMINI_API_KEY) sources.push('window');
                      if (localStorage.getItem('VITE_GEMINI_API_KEY')) sources.push('localStorage');
                      setKeyDetectedFrom(sources);
                    } catch (err) { console.error('Failed to save Gemini key', err); }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-violet-600 text-white disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-violet-700"
                >Save</button>
                <button
                  onClick={() => {
                    try {
                      localStorage.removeItem('VITE_GEMINI_API_KEY');
                      delete (window as any).VITE_GEMINI_API_KEY;
                      const sources: Array<'vite' | 'window' | 'localStorage'> = [];
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const envAny = (import.meta as any);
                      if (envAny?.env?.VITE_GEMINI_API_KEY) sources.push('vite');
                      setKeyDetectedFrom(sources);
                    } catch (err) { console.error('Failed to clear Gemini key', err); }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                >Clear</button>
                <button
                  onClick={async () => {
                    setApiKeyStatus('checking');
                    setApiKeyError(null);
                    const t0 = performance.now();
                    const res = await verifyApiKey();
                    const ms = Math.round(performance.now() - t0);
                    setLastVerifyMs(ms);
                    setLastVerifyAt(new Date().toLocaleString());
                    if (res.valid) {
                      setApiKeyStatus('valid');
                    } else {
                      setApiKeyStatus('invalid');
                      setApiKeyError(res.error ?? 'Unknown error');
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >Quick verify</button>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Detected from:</span>
                <span className="ml-1">{keyDetectedFrom.length > 0 ? keyDetectedFrom.join(', ') : 'none'}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Precedence: .env/.env.local (Vite) → window.VITE_GEMINI_API_KEY → localStorage.
              </div>
            </div>
          </div>
        )}
        {imageTestStatus !== 'idle' && (
          <div className="mt-4 space-y-2" aria-live="polite">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Image Fallback Results</h4>
            {imageTestResults.length === 0 && imageTestStatus === 'running' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Running quick test calls…</p>
            )}
            {imageTestResults.map(r => {
              // Extract HF endpoint from note if present: format 'HF endpoint: router' or 'legacy'
              let endpoint: string | null = null;
              if (r.note) {
                const match = r.note.match(/HF endpoint:\s*(router|legacy)/i);
                if (match) endpoint = match[1].toLowerCase();
              }
              return (
                <div key={r.label} className={`text-xs p-2 rounded border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${r.success ? 'border-green-200 bg-green-50 dark:bg-green-900/30 dark:border-green-800/50' : 'border-red-200 bg-red-50 dark:bg-red-900/30 dark:border-red-800/50'}`}> 
                  <div className="flex flex-col">
                    <span className="font-medium">{r.label}</span>
                    {r.success ? (
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        <span className="">Provider: {r.provider || 'unknown'}</span>
                        {endpoint && (
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase ${endpoint === 'router' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300'}`}>endpoint: {endpoint}</span>
                        )}
                        {r.note && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{r.note.replace(/HF endpoint:\s*(router|legacy)/i,'').trim().replace(/^·\s*/,'')}</span>
                        )}
                      </div>
                    ) : (
                      <span className="">Error: {r.error}</span>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 font-medium ${r.success ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}> 
                    <span className={`w-2.5 h-2.5 rounded-full ${r.success ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    {r.success ? 'Success' : 'Failed'}
                  </span>
                </div>
              );
            })}
            {imageTestStatus === 'done' && imageTestResults.every(r => !r.success) && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">All test attempts failed. This can happen if your key lacks image billing or if you hit rate limits. Try adding a free provider token (Hugging Face) or switching model preference.</p>
            )}
            {imageTestStatus === 'done' && imageTestResults.some(r => (r.error || '').includes('RATE_LIMIT:')) && (
              <p className="text-[11px] text-violet-700 dark:text-violet-300">Detected rate limiting during tests. We automatically delayed between attempts; wait a moment and press Retest to confirm fallback success.</p>
            )}
            {imageTestStatus !== 'running' && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Endpoint legend:</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">endpoint: router</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300">endpoint: legacy</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Fallback order:</span>
                  <span className="ml-1">If a Hugging Face token is saved, we try Hugging Face first, then your selected Google provider, then the alternate provider.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {showHFManager && (
          <div className="mt-6 border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">Hugging Face Token {hfTokenSaved && <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300">Active</span>}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Optional free provider used before Google image models. Stored locally in your browser.</p>
            <div className="flex flex-col gap-2 max-w-md">
              <input
                type="password"
                value={hfTokenInput}
                onChange={e => setHfTokenInput(e.target.value.trim())}
                placeholder="Paste hf_*** token"
                className="p-2 text-xs rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={!hfTokenInput}
                  onClick={() => {
                    try {
                      localStorage.setItem('VITE_HF_API_TOKEN', hfTokenInput);
                      setHfTokenSaved(hfTokenInput);
                      setHfTokenInput('');
                    } catch (err) { console.error('Failed to save HF token', err); }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-violet-600 text-white disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-violet-700"
                >Save</button>
                <button
                  disabled={!hfTokenSaved}
                  onClick={() => {
                    try {
                      localStorage.removeItem('VITE_HF_API_TOKEN');
                      setHfTokenSaved(null);
                    } catch (err) { console.error('Failed to clear HF token', err); }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-300 dark:hover:bg-slate-600"
                >Clear</button>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">If present, Hugging Face is attempted first for image generation. Clear to rely solely on Google models.</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg p-4 sm:p-6 mb-6">
        <div className="border-b border-slate-200 dark:border-slate-700/50 pb-4 mb-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                <div className="w-4 h-4 rounded-full bg-green-500 animate-pulse"></div>
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">All Systems Operational</h3>
            </div>
        </div>
        <div className="space-y-4">
          {services.map((service, index) => {
            const statusClasses = getStatusIndicatorClasses(service.status);
            return (
              <div key={index} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 ${statusClasses.bg} rounded-lg gap-2`}>
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">{service.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{service.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className={`w-3 h-3 rounded-full ${statusClasses.dot}`}></div>
                  <span className={`text-sm font-medium ${statusClasses.text}`}>{service.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

     <div className="bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg p-4 sm:p-6 mb-6">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Recent Incidents</h3>
            <div className="space-y-6">
                {incidents.map((incident, index) => (
                    <div key={index} className="relative pl-8">
                        <div className="absolute left-0 top-1 w-4 h-4 bg-violet-200 dark:bg-violet-900/50 rounded-full border-4 border-white dark:border-slate-900/50"></div>
                        <div className={`absolute left-[7px] top-1 h-full w-0.5 ${index === incidents.length - 1 ? 'hidden' : 'bg-slate-200 dark:bg-slate-700/50'}`}></div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{incident.date} - {incident.time}</p>
                        <h4 className="font-semibold text-slate-700 dark:text-slate-300 mt-1">{incident.title}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{incident.description}</p>
                    </div>
                ))}
            </div>
       </div>
      <ActivityViewer />

    </div>
  );
};

export default SystemStatus;