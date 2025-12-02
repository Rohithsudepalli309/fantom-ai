import React, { useEffect, useMemo, useRef, useState } from 'react';
import { checkNemotronHealth, isNemotronConfigured } from '@/services/nemotronService';
import { checkGrokHealth, isGrokConfigured } from '@/services/grokService';
import { useSettings } from '@/contexts/SettingsContext';
import { AppSettings } from '@/contexts/appSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toaster';

// Professional settings layout: left category list, right content panels stacked with rows
const CATEGORIES = [
  { id: 'api', label: 'API Key' },
  { id: 'chat', label: 'Chat' },
  { id: 'vision', label: 'Vision' },
  { id: 'text', label: 'Text' },
  { id: 'image', label: 'Image' },
  { id: 'general', label: 'General' },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

const SettingRow: React.FC<{ title: string; description?: string; control: React.ReactNode }> = ({ title, description, control }) => (
  <div className="flex items-start justify-between gap-4 py-3">
    <div>
      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{title}</div>
      {description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-prose">{description}</div>}
    </div>
    <div className="min-w-[220px] flex items-center justify-end">{control}</div>
  </div>
);

const SectionCard: React.FC<{ id: CategoryId; title: string; children: React.ReactNode }> = ({ id, title, children }) => (
  <section id={id} className="bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg p-4 sm:p-6">
    <h3 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2 sm:mb-3">{title}</h3>
    <div className="divide-y divide-slate-200 dark:divide-slate-700/60">
      {children}
    </div>
  </section>
);

const Settings: React.FC = () => {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { user, signOut } = useAuth();
  const { show } = useToast();
  const [activeCat, setActiveCat] = useState<CategoryId>('api');

  // NVIDIA API Key state
  const [nvidiaKeyInput, setNvidiaKeyInput] = useState('');
  const [nvidiaKeyStatus, setNvidiaKeyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [nvidiaKeyMsg, setNvidiaKeyMsg] = useState<string | null>(null);

  // Grok API Key state
  const [grokKeyInput, setGrokKeyInput] = useState('');
  const [grokKeyStatus, setGrokKeyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [grokKeyMsg, setGrokKeyMsg] = useState<string | null>(null);

  const apiKeyPresent = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const envAny = import.meta as any;
      const viteKey = envAny?.env?.VITE_NVIDIA_API_KEY as string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const winKey = (typeof window !== 'undefined' ? (window as any)?.VITE_NVIDIA_API_KEY : undefined) as string | undefined;
      const lsKey = (typeof window !== 'undefined' ? window.localStorage?.getItem('VITE_NVIDIA_API_KEY') ?? undefined : undefined);
      return Boolean(viteKey || winKey || lsKey);
    } catch {
      return false;
    }
  }, []);

  const saveSettings = (next: Partial<AppSettings>) => {
    // If enabling notifications, ask for permission once
    if (next.notifications) {
      try {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => { });
        }
      } catch {/* ignore */ }
    }
    updateSettings(next);
    // Fire a toast for feedback (debounced effect is fine for single interactions)
    const keys = Object.keys(next);
    if (keys.length === 1) {
      show({ message: `Updated ${keys[0]} setting`, variant: 'success', duration: 2400 });
    } else if (keys.length > 1) {
      show({ message: 'Settings updated', variant: 'success', duration: 2400 });
    }
  };

  // Observe sections to update active category as user scrolls
  const observerRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const headings = CATEGORIES.map(c => document.getElementById(c.id)).filter(Boolean) as HTMLElement[];
    if (!('IntersectionObserver' in window) || headings.length === 0) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top - b.boundingClientRect.top));
        if (visible[0]) {
          const id = visible[0].target.id as CategoryId;
          setActiveCat(id);
        }
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.25, 0.5, 1] }
    );
    headings.forEach(h => observerRef.current?.observe(h));
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: CategoryId) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveCat(id);
  };

  return (
    <div className="h-full flex flex-col p-2 sm:p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Settings</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Configure keys and tune features. Changes are saved automatically.</p>
        </div>
        <button
          className="px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
          onClick={resetSettings}
          title="Reset all settings to defaults"
        >Reset to defaults</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 h-full min-h-0">
        {/* Left category list */}
        <nav className="bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg p-2 sm:p-3 lg:sticky lg:top-2 self-start max-h-[80vh] overflow-auto">
          <ul className="space-y-1">
            {CATEGORIES.map(cat => (
              <li key={cat.id}>
                <button
                  onClick={() => scrollTo(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeCat === cat.id ? 'bg-violet-600 text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
                  aria-current={activeCat === cat.id ? 'true' : undefined}
                >{cat.label}</button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Right content as professional list of grouped rows */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
          <SectionCard id="api" title="API Key">
            <SettingRow
              title="NVIDIA API Key"
              description="Your key is stored locally. Required for Nemotron services (Text, Chat, Vision)."
              control={(
                <div className="flex flex-col items-end gap-2 w-full max-w-xs">
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="password"
                      value={nvidiaKeyInput}
                      onChange={e => setNvidiaKeyInput(e.target.value.trim())}
                      placeholder="Paste VITE_NVIDIA_API_KEY"
                      className="flex-1 p-2 text-sm rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                      aria-label="NVIDIA API key"
                    />
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${isNemotronConfigured()
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                      {isNemotronConfigured() ? '✓ Set' : 'Not set'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={!nvidiaKeyInput}
                      onClick={() => {
                        try {
                          localStorage.setItem('VITE_NVIDIA_API_KEY', nvidiaKeyInput);
                          (window as any).VITE_NVIDIA_API_KEY = nvidiaKeyInput;
                          setNvidiaKeyInput('');
                          show({ message: 'NVIDIA API key saved', variant: 'success' });
                        } catch (err) { console.error('Failed to save NVIDIA key', err); }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-violet-600 text-white disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-violet-700"
                    >Save</button>
                    <button
                      onClick={() => {
                        try {
                          localStorage.removeItem('VITE_NVIDIA_API_KEY');
                          delete (window as any).VITE_NVIDIA_API_KEY;
                          show({ message: 'NVIDIA API key cleared', variant: 'info' });
                        } catch (err) { console.error('Failed to clear NVIDIA key', err); }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                    >Clear</button>
                    <button
                      onClick={async () => {
                        setNvidiaKeyStatus('checking');
                        setNvidiaKeyMsg(null);
                        const res = await checkNemotronHealth();
                        if (res.ok) {
                          setNvidiaKeyStatus('valid');
                          setNvidiaKeyMsg('API key is valid.');
                          show({ message: 'NVIDIA API key valid', variant: 'success' });
                        } else {
                          setNvidiaKeyStatus('invalid');
                          setNvidiaKeyMsg(res.message ?? 'Unknown error');
                          show({ message: 'NVIDIA API key invalid', variant: 'error' });
                        }
                      }}
                      disabled={!isNemotronConfigured()}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >Verify</button>
                  </div>
                  {nvidiaKeyStatus !== 'idle' && (
                    <div className={`w-full text-xs p-2 rounded border ${nvidiaKeyStatus === 'valid'
                        ? 'border-green-200 bg-green-50 dark:bg-green-900/30 dark:border-green-800/50 text-green-700 dark:text-green-300'
                        : nvidiaKeyStatus === 'checking'
                          ? 'border-slate-300 bg-slate-50 dark:bg-slate-800/30 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          : 'border-red-200 bg-red-50 dark:bg-red-900/30 dark:border-red-800/50 text-red-700 dark:text-red-300'
                      }`}>
                      {nvidiaKeyStatus === 'checking' ? 'Verifying…' : nvidiaKeyMsg}
                    </div>
                  )}
                </div>
              )}
            />
            <SettingRow
              title="xAI Grok API Key"
              description="Required for Grok image generation. Stored locally for your security."
              control={(
                <div className="flex flex-col items-end gap-2 w-full max-w-xs">
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="password"
                      value={grokKeyInput}
                      onChange={e => setGrokKeyInput(e.target.value.trim())}
                      placeholder="Paste VITE_XAI_API_KEY"
                      className="flex-1 p-2 text-sm rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                      aria-label="xAI Grok API key"
                    />
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${isGrokConfigured()
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                      {isGrokConfigured() ? '✓ Set' : 'Not set'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={!grokKeyInput}
                      onClick={() => {
                        try {
                          localStorage.setItem('VITE_XAI_API_KEY', grokKeyInput);
                          (window as any).VITE_XAI_API_KEY = grokKeyInput;
                          setGrokKeyInput('');
                          show({ message: 'Grok API key saved', variant: 'success' });
                        } catch (err) { console.error('Failed to save Grok key', err); }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-blue-700"
                    >Save</button>
                    <button
                      onClick={() => {
                        try {
                          localStorage.removeItem('VITE_XAI_API_KEY');
                          delete (window as any).VITE_XAI_API_KEY;
                          show({ message: 'Grok API key cleared', variant: 'info' });
                        } catch (err) { console.error('Failed to clear Grok key', err); }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                    >Clear</button>
                    <button
                      onClick={async () => {
                        setGrokKeyStatus('checking');
                        setGrokKeyMsg(null);
                        const res = await checkGrokHealth();
                        if (res.ok) {
                          setGrokKeyStatus('valid');
                          setGrokKeyMsg('Grok API key is valid.');
                          show({ message: 'Grok API key valid', variant: 'success' });
                        } else {
                          setGrokKeyStatus('invalid');
                          setGrokKeyMsg(res.message ?? 'Unknown error');
                          show({ message: 'Grok API key invalid', variant: 'error' });
                        }
                      }}
                      disabled={!isGrokConfigured()}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >Verify</button>
                  </div>
                  {grokKeyStatus !== 'idle' && (
                    <div className={`w-full text-xs p-2 rounded border ${grokKeyStatus === 'valid'
                        ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-800/50 text-blue-700 dark:text-blue-300'
                        : grokKeyStatus === 'checking'
                          ? 'border-slate-300 bg-slate-50 dark:bg-slate-800/30 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          : 'border-red-200 bg-red-50 dark:bg-red-900/30 dark:border-red-800/50 text-red-700 dark:text-red-300'
                      }`}>
                      {grokKeyStatus === 'checking' ? 'Verifying…' : grokKeyMsg}
                    </div>
                  )}
                  <div className="w-full text-[11px] text-right text-slate-600 dark:text-slate-300">
                    Detected: {apiKeyPresent ? 'Yes' : 'No'} · Precedence: Vite env → window → localStorage
                  </div>
                </div>
              )}
            />
          </SectionCard>

          <SectionCard id="chat" title="Chat">
            <SettingRow
              title="Chat history"
              description="Store recent conversations locally to improve continuity."
              control={(
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={settings.chatHistoryEnabled} onChange={e => saveSettings({ chatHistoryEnabled: e.target.checked })} />
                  <span className="text-sm">Enable</span>
                </label>
              )}
            />
            <SettingRow
              title="Notifications"
              description="Show a notification when a response completes in the background."
              control={(
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={settings.notifications} onChange={e => saveSettings({ notifications: e.target.checked })} />
                  <span className="text-sm">Enable</span>
                </label>
              )}
            />

          </SectionCard>

          <SectionCard id="vision" title="Vision">
            <SettingRow
              title="Enable vision features"
              description="Allow the app to analyze images and answer questions about them."
              control={(
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={settings.visionEnabled} onChange={e => saveSettings({ visionEnabled: e.target.checked })} />
                  <span className="text-sm">Enable</span>
                </label>
              )}
            />
            <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400">Uploads are processed locally and sent to the selected model only when you submit a request.</div>
          </SectionCard>

          <SectionCard id="text" title="Text">
            <SettingRow
              title={`Temperature (${settings.temperature.toFixed(2)})`}
              description="Lower is more deterministic, higher is more creative."
              control={(
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.01}
                  value={settings.temperature}
                  onChange={e => saveSettings({ temperature: Number(e.target.value) })}
                  className="w-full"
                />
              )}
            />
            <SettingRow
              title={`Max tokens (${settings.maxOutputTokens})`}
              description="Upper bound for response length."
              control={(
                <input
                  type="range"
                  min={256}
                  max={8192}
                  step={64}
                  value={settings.maxOutputTokens}
                  onChange={e => saveSettings({ maxOutputTokens: Number(e.target.value) })}
                  className="w-full"
                />
              )}
            />
          </SectionCard>

          <SectionCard id="image" title="Image">
            <SettingRow
              title="Style"
              description="Preset visual style applied when enhancing prompts."
              control={(
                <select
                  value={settings.imageStyle}
                  onChange={e => saveSettings({ imageStyle: e.target.value as AppSettings['imageStyle'] })}
                  className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-w-[220px]"
                >
                  <option value="none">None</option>
                  <option value="photorealistic">Photorealistic</option>
                  <option value="cinematic">Cinematic</option>
                  <option value="anime">Anime</option>
                  <option value="digital-art">Digital Art</option>
                  <option value="watercolor">Watercolor</option>
                  <option value="oil-painting">Oil Painting</option>
                  <option value="pixel-art">Pixel Art</option>
                  <option value="isometric">Isometric</option>
                  <option value="low-poly">Low Poly</option>
                  <option value="cyberpunk">Cyberpunk</option>
                  <option value="neon-noir">Neon Noir</option>
                  <option value="line-art">Line Art</option>
                  <option value="sketch">Sketch</option>
                  <option value="3d-render">3D Render</option>
                </select>
              )}
            />
            <SettingRow
              title="Size"
              description="Aspect ratio affects composition; some models adapt internally."
              control={(
                <select
                  value={settings.imageSize}
                  onChange={e => saveSettings({ imageSize: e.target.value as AppSettings['imageSize'] })}
                  className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-w-[220px]"
                >
                  <option value="1:1">1:1 (Square)</option>
                  <option value="16:9">16:9 (Landscape)</option>
                  <option value="9:16">9:16 (Portrait)</option>
                  <option value="4:3">4:3</option>
                  <option value="3:2">3:2</option>
                  <option value="2:3">2:3</option>
                  <option value="21:9">21:9 (Ultra-wide)</option>
                  <option value="9:21">9:21 (Tall)</option>
                  <option value="5:4">5:4</option>
                </select>
              )}
            />
            <SettingRow
              title="Format"
              description="Output image format when downloading or exporting."
              control={(
                <select
                  value={settings.imageFormat}
                  onChange={e => saveSettings({ imageFormat: e.target.value as AppSettings['imageFormat'] })}
                  className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-w-[220px]"
                >
                  <option value="png">PNG (lossless)</option>
                  <option value="jpeg">JPEG (compressed)</option>
                  <option value="webp">WebP (modern)</option>
                </select>
              )}
            />
          </SectionCard>

          <SectionCard id="general" title="General">
            <SettingRow
              title="Theme"
              control={(
                <select
                  value={settings.theme}
                  onChange={e => saveSettings({ theme: e.target.value as AppSettings['theme'] })}
                  className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-w-[220px]"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              )}
            />
            <SettingRow
              title="Language"
              control={(
                <select
                  value={settings.language}
                  onChange={e => saveSettings({ language: e.target.value as AppSettings['language'] })}
                  className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 min-w-[220px]"
                >
                  <option value="en">English</option>
                  <option value="auto">Auto</option>
                </select>
              )}
            />
            <SettingRow
              title="Session"
              description={user ? `Signed in as ${user.email}` : 'No active session.'}
              control={(
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => signOut()}
                    disabled={!user}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-red-600 text-white disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-red-700"
                  >Sign out</button>
                  <button
                    onClick={() => {
                      try {
                        localStorage.setItem('auth_intent', JSON.stringify({ action: 'switch-account', ts: Date.now() }));
                      } catch { }
                      signOut();
                    }}
                    disabled={!user}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-900 text-white dark:bg-white dark:text-slate-900 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed hover:opacity-90"
                    title="Sign out and return to login"
                  >Switch account</button>
                </div>
              )}
            />
          </SectionCard>

          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Need help? Hover over controls for hints. Your settings are stored locally in your browser.
          </div>
        </div>
      </div >
    </div >
  );
};

export default Settings;
