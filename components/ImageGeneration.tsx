import React, { useState, useEffect } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useRateLimitStatus } from '@/hooks/useRateLimitStatus';
import { enhancePrompt, generateRobustImage, getRateLimitStatus } from '../services/geminiService';
import { useAuth } from '@/contexts/AuthContext';
import { recordActivitySafe } from '@/services/storageService';
import { type ImageGenerationHistoryEntry, type ImageGenerationResponse, ImageModel, ImageStyle, AspectRatio, ImageFormat } from '../types';
import { 
    ImageIcon, ErrorIcon, SparklesIcon, HistoryIcon, StarIcon,
    RegenerateIcon, DownloadIcon, ShareIcon, CheckIcon, TrashIcon
} from './Icons';
import { useSettings } from '@/contexts/SettingsContext';

interface ImageGenerationState {
  prompt: string;
  model: ImageModel;
  style: ImageStyle;
  aspectRatio: AspectRatio;
    format: ImageFormat;
}

// Initial settings; model may be adjusted once on mount depending on provider/token availability.
const initialState: ImageGenerationState = {
    prompt: '',
    model: 'imagen-4.0-generate-001', // will switch to Nano if no HF token and billing errors seen
    style: 'none',
    aspectRatio: '1:1',
    format: 'png',
};

const ImageGeneration: React.FC = () => {
    const { user } = useAuth();
    const { settings: globalSettings, updateSettings: updateGlobalSettings } = useSettings();
    const [settings, setSettings] = useState<ImageGenerationState>(() => ({
        ...initialState,
        style: globalSettings.imageStyle,
        aspectRatio: globalSettings.imageSize as AspectRatio,
        format: globalSettings.imageFormat,
    }));
    const [result, setResult] = useState<ImageGenerationResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState<'idle' | 'enhancing' | 'generating'>('idle');
    const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);

    const { prompt, model, style, aspectRatio } = settings;
    // Advanced controls (HF only)
    const [advOpen, setAdvOpen] = useState<boolean>(false);
    const [advWidth, setAdvWidth] = useState<number>(1024);
    const [advHeight, setAdvHeight] = useState<number>(1024);
    const [advSteps, setAdvSteps] = useState<number>(20);
    const [advGuidance, setAdvGuidance] = useState<number>(7);
    const [advModel, setAdvModel] = useState<string>('stabilityai/stable-diffusion-xl-base-1.0');
    const [advNegative, setAdvNegative] = useState<string>('');
    const [hfAvailable, setHfAvailable] = useState<boolean>(false);
    const [hfReachable, setHfReachable] = useState<boolean>(false);
    const [showHfHelper, setShowHfHelper] = useState<boolean>(() => {
        try { return sessionStorage.getItem('hide_hf_helper') !== '1'; } catch { return true; }
    });

    const [history, setHistory] = useState<ImageGenerationHistoryEntry[]>(() => {
        try {
            const savedHistory = localStorage.getItem('imageGenerationHistory_v2');
            return savedHistory ? JSON.parse(savedHistory) : [];
        } catch (error) {
            console.error("Failed to parse image generation history:", error);
            return [];
        }
    });
    
    const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
    const [showClearDialog, setShowClearDialog] = useState(false);
    const { coolingDown, resumeInMs } = useRateLimitStatus();

    // (Diagnostics removed from UI; keeping component lean.)

    useEffect(() => {
        try {
            const historyToSave = history.map(entry => {
                if (entry.result.success && entry.result.url.startsWith('data:image')) {
                    return { ...entry, result: { ...entry.result, url: 'local_preview' } };
                }
                return entry;
            });
            localStorage.setItem('imageGenerationHistory_v2', JSON.stringify(historyToSave));
        } catch (error) {
            console.error("Failed to save image generation history:", error);
        }
    }, [history]);

    // Detect Hugging Face availability to conditionally show model option
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // Lightweight detection: rely on System Status checker
                const apis = await import('@/services/geminiService');
                const result = await apis.checkAllApis();
                if (!cancelled) {
                    // Consider HF selectable if token is detected, even if reachability check fails (browser CORS, etc.)
                    setHfAvailable(!!result.details.huggingFaceTokenDetected);
                    setHfReachable(!!result.details.huggingFaceReachable);
                }
            } catch {
                if (!cancelled) { setHfAvailable(false); setHfReachable(false); }
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Do not auto-downgrade; allow users to try HF even if reachability probe failed.
    
    const updateSetting = <K extends keyof ImageGenerationState>(key: K, value: ImageGenerationState[K]) => {
        setSettings(s => ({ ...s, [key]: value }));
        if (key === 'style') updateGlobalSettings({ imageStyle: value as ImageStyle });
        if (key === 'aspectRatio') updateGlobalSettings({ imageSize: value as AspectRatio });
    };

    const handleGenerate = async (p: string, m: ImageModel, st: ImageStyle, ar: AspectRatio) => {
        // Allow Hugging Face generation even during Google cooldown
        if (coolingDown && m !== 'huggingface') {
            setResult({ success: false, error: `Cooling down. Please wait ${(resumeInMs/1000).toFixed(1)}s before retrying.` });
            return;
        }
        if (!p.trim()) return;

        setIsLoading(true);
        setResult(null);
        setEnhancedPrompt(null);
        
        let finalPrompt = p;
        let enhanced: string | null = null;
        if (m === 'imagen-4.0-generate-001' || st !== 'none') {
            setLoadingStep('enhancing');
            const enhancedP = await enhancePrompt(p, st);
            finalPrompt = enhancedP;
            enhanced = enhancedP;
            setEnhancedPrompt(enhancedP);
        }
        
        setLoadingStep('generating');
        // Centralized robust flow (serializes requests & handles fallbacks)
        const advanced = m === 'huggingface' && advOpen ? {
            width: advWidth,
            height: advHeight,
            steps: advSteps,
            guidance: advGuidance,
            modelOverride: advModel,
            negativePrompt: advNegative || undefined,
        } : undefined;
        const response: ImageGenerationResponse = await generateRobustImage(finalPrompt, st, ar, m, settings.format, advanced);
        
    setResult(response);
        setIsLoading(false);
        setLoadingStep('idle');

        const newHistoryEntry: ImageGenerationHistoryEntry = {
            id: `img-session-${Date.now()}`,
            timestamp: new Date().toISOString(),
            prompt: p,
            enhancedPrompt: enhanced,
            result: response,
            model: m, style: st, aspectRatio: ar,
            isFavorite: false,
        };
        setHistory(prev => [newHistoryEntry, ...prev]);

        // Record activity (user-scoped)
        if (user?.uid) {
            await recordActivitySafe(user.uid, 'image.generate', {
                model: m,
                style: st,
                aspectRatio: ar,
                success: response.success,
                provider: (response as any)?.provider,
                note: (response as any)?.note,
            });
        }
    };
    
    const handleRegenerate = (entry: ImageGenerationHistoryEntry) => {
        // Preserve current format and any future fields by merging
        setSettings((prev) => ({
            ...prev,
            prompt: entry.prompt,
            model: entry.model,
            style: entry.style,
            aspectRatio: entry.aspectRatio,
        }));
        handleGenerate(entry.prompt, entry.model, entry.style, entry.aspectRatio);
    };

    const handleFavorite = (id: string) => {
        setHistory(history.map(entry => 
            entry.id === id ? { ...entry, isFavorite: !entry.isFavorite } : entry
        ));
    };
    
    const handleShare = (url: string) => {
        navigator.clipboard.writeText(url).then(() => {
            setShareState('copied');
            setTimeout(() => setShareState('idle'), 2000);
        });
    };

    const handleDownload = (url: string) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fantom-ai-image.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleClearHistory = () => {
        setShowClearDialog(true);
    };

        // One-time model adjustment on mount:
        // - If Hugging Face token exists, prefer HF to avoid Google billing limits
        // - Else default to Nano (fast, no billing) over Imagen
        useEffect(() => {
            try {
                // Check multiple sources for token presence
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const envAny = import.meta as any;
                const envToken: string | undefined = envAny?.env?.VITE_HF_API_TOKEN;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const winToken: string | undefined = typeof window !== 'undefined' ? (window as any)?.VITE_HF_API_TOKEN : undefined;
                const lsToken = typeof window !== 'undefined' ? localStorage.getItem('VITE_HF_API_TOKEN') ?? undefined : undefined;
                const hasHf = Boolean(envToken || winToken || lsToken);
                setSettings(s => ({ ...s, model: hasHf ? 'huggingface' : 'gemini-2.5-flash-image' }));
            } catch {/* ignore */}
        }, []);
    
    // (Removed HF token UI; users now manage token in System Status panel.)

    const renderResult = () => {
        if (isLoading) {
            let message = "Generating...";
            if(loadingStep === 'enhancing') message = "Giving your prompt an artistic touch...";
            if(loadingStep === 'generating') message = "Painting your masterpiece...";
            return (
                 <div className="flex flex-col items-center justify-center h-full text-center">
                    <SparklesIcon className="w-12 h-12 text-violet-500 animate-pulse" />
                    <p className="mt-2 text-slate-500 dark:text-slate-400">{message}</p>
                    {enhancedPrompt && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm truncate">Enhanced: "{enhancedPrompt}"</p>}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">This may take a moment.</p>
                </div>
            );
        }
        
        if (result?.success === true) {
            return (
                <div className="relative w-full h-full group">
                    <img 
                        src={result.url}
                        alt={`Generated image for prompt: ${prompt}`}
                        className="w-full h-full rounded-lg object-contain"
                    />
                    {result.provider && (
                        <div className="absolute left-2 bottom-2 text-[10px] px-2 py-0.5 rounded bg-black/60 text-white space-x-1">
                            <span>Provider: {result.provider}</span>
                            {result.note && (<span className="opacity-80">· {result.note}</span>)}
                        </div>
                    )}
                    <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-1 rounded-lg">
                        <ActionButton tooltip="Regenerate" onClick={() => handleGenerate(prompt, model, style, aspectRatio)}><RegenerateIcon className="w-5 h-5"/></ActionButton>
                        <ActionButton tooltip="Download" onClick={() => handleDownload(result.url)}><DownloadIcon className="w-5 h-5"/></ActionButton>
                        <ActionButton tooltip={shareState === 'copied' ? 'Copied!' : 'Share'} onClick={() => handleShare(result.url)}>
                            {shareState === 'copied' ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ShareIcon className="w-5 h-5" />}
                        </ActionButton>
                    </div>
                </div>
            );
        }
        
        if (result?.success === false) {
            const billedMsg = (result.error || '').toLowerCase().includes('billed');
            const rateLimited = (result.error || '').includes('RATE_LIMIT:');
            const cooldownMsg = (result.error || '').toLowerCase().includes('cooling down');
             return (
                <div className="m-auto flex flex-col items-center gap-2 text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <ErrorIcon className="w-8 h-8 text-red-500" />
                    <p className="text-red-600 dark:text-red-300 text-sm font-medium">{result.error}</p>
                    {(billedMsg || rateLimited || cooldownMsg) && (
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                            {billedMsg && (
                                <button
                                    onClick={() => {
                                        updateSetting('model', 'gemini-2.5-flash-image');
                                        handleGenerate(prompt, 'gemini-2.5-flash-image', style, aspectRatio);
                                    }}
                                    className="px-3 py-1.5 text-xs font-semibold rounded bg-violet-600 text-white hover:bg-violet-700"
                                >Switch to Nano</button>
                            )}
                            {rateLimited && (
                                <>
                                    <button
                                        onClick={() => {
                                            // Explicitly try HF provider to avoid billed/rate-limited Imagen
                                            updateSetting('model', 'huggingface');
                                            handleGenerate(prompt, 'huggingface', style, aspectRatio);
                                        }}
                                        className="px-3 py-1.5 text-xs font-semibold rounded bg-violet-600 text-white hover:bg-violet-700"
                                    >Try Hugging Face</button>
                                    <button
                                        onClick={() => handleGenerate(prompt, model, style, aspectRatio)}
                                        className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                                    >Retry</button>
                                    <button
                                        onClick={() => {
                                            updateSetting('model', 'gemini-2.5-flash-image');
                                            handleGenerate(prompt, 'gemini-2.5-flash-image', style, aspectRatio);
                                        }}
                                        className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                                    >Switch to Nano</button>
                                </>
                            )}
                            {cooldownMsg && (
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Cooldown {(resumeInMs/1000).toFixed(1)}s</span>
                            )}
                        </div>
                    )}
                </div>
            );
        }
        
        return (
            <div className="m-auto flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 py-4">
                <ImageIcon className="w-12 h-12 mb-1" />
                <p className="text-sm">Your generated image will appear here.</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col lg:flex-row gap-4">
            <div className="w-full lg:w-96 flex-shrink-0 bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg p-4 flex flex-col">
                <header className="mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Image Generation</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Create stunning visuals from text.</p>
                </header>
                
                <div className="flex-grow overflow-y-auto pr-2 space-y-4 min-h-0">
                    <div>
                        <label className="text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Your Prompt</label>
                        <textarea 
                            value={prompt} 
                            onChange={(e) => updateSetting('prompt', e.target.value)} 
                            placeholder="e.g., A futuristic cityscape at sunset..."
                            className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none text-sm"
                            rows={5}
                        />
                    </div>
                                        <div>
                                                <label className="text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Model</label>
                                                                                                <SegmentedControl
                                                                                                    options={[
                                                                                                      {id: 'imagen-4.0-generate-001', label: 'Imagen', tooltip: "Highest quality (may require billing)."},
                                                                                                      {id: 'gemini-2.5-flash-image', label: 'Nano', tooltip: "Fast & lightweight."},
                                                                                                      { id: 'huggingface', label: 'HF', tooltip: hfAvailable ? (hfReachable ? 'Uses your Hugging Face token.' : 'Token detected; network check pending. You can still try HF.') : 'Requires VITE_HF_API_TOKEN (see System Status).', disabled: false }
                                                                                                    ]}
                                                                                                    selected={model}
                                                                                                    setSelected={(val) => updateSetting('model', val as ImageModel)}
                                                                                                />
                                                                                                                                                                                                <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                                                                                                                                                                                                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 mr-1">
                                                                                                                                                                                                        {model === 'huggingface' ? 'Provider: Hugging Face' : model === 'gemini-2.5-flash-image' ? 'Provider: Google (Nano)' : 'Provider: Google (Imagen)'}
                                                                                                                                                                                                    </span>
                                                                                                                                                                                                    {model === 'imagen-4.0-generate-001' && (
                                                                                                                                                                                                        <span>May require billing.</span>
                                                                                                                                                                                                    )}
                                                                                                                                                                                                    {model === 'huggingface' && !hfAvailable && (
                                                                                                                                                                                                        <span>Token missing. Add VITE_HF_API_TOKEN.</span>
                                                                                                                                                                                                    )}
                                                                                                                                                                                                </div>
                                    {model === 'huggingface' && (
                                        <div className="mt-2 border rounded-md border-slate-300 dark:border-slate-700">
                                            <button
                                                className="w-full text-left px-3 py-2 text-sm font-semibold bg-slate-100 dark:bg-slate-800 rounded-t-md"
                                                onClick={() => setAdvOpen(v => !v)}
                                                aria-expanded={advOpen}
                                            >Advanced (SDXL)</button>
                                            {advOpen && (
                                                <div className="px-3 py-2 space-y-2">
                                                    <div className="flex gap-2 items-center">
                                                        <label className="text-xs w-28">HF Model</label>
                                                        <select className="flex-1 p-1 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                                                            value={advModel}
                                                            onChange={e => setAdvModel(e.target.value)}>
                                                            <option value="stabilityai/stable-diffusion-xl-base-1.0">SDXL Base 1.0 (HF)</option>
                                                            <option value="black-forest-labs/FLUX.1-schnell">FLUX.1-schnell (HF)</option>
                                                            <option value="stabilityai/sd-turbo">SD-Turbo (HF)</option>
                                                        </select>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <label className="text-xs w-16">Width</label>
                                                            <input type="number" min={64} step={64} className="w-full p-1 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded" value={advWidth} onChange={e => setAdvWidth(parseInt(e.target.value || '0', 10) || 64)} />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <label className="text-xs w-16">Height</label>
                                                            <input type="number" min={64} step={64} className="w-full p-1 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded" value={advHeight} onChange={e => setAdvHeight(parseInt(e.target.value || '0', 10) || 64)} />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <label className="text-xs w-16">Steps</label>
                                                            <input type="number" min={1} max={75} className="w-full p-1 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded" value={advSteps} onChange={e => setAdvSteps(Math.max(1, Math.min(75, parseInt(e.target.value || '1', 10))))} />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <label className="text-xs w-16">CFG</label>
                                                            <input type="number" min={0} max={20} step={0.5} className="w-full p-1 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded" value={advGuidance} onChange={e => setAdvGuidance(Math.max(0, Math.min(20, parseFloat(e.target.value || '0'))))} />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs">Negative Prompt</label>
                                                        <input type="text" className="w-full mt-1 p-1 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded" value={advNegative} onChange={e => setAdvNegative(e.target.value)} placeholder="e.g., low quality, blurry" />
                                                    </div>
                                                    <p className="text-[11px] text-slate-500">Tip: SDXL prefers dimensions in multiples of 64. Defaults are 1024×1024.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                                                                                {!hfAvailable && showHfHelper && (
                                                                                                    <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                                                                                                        <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px]">HF requires token</span>
                                                                                                        <span>Add your Hugging Face token in the System Status page to enable.</span>
                                                                                                        <div className="ml-auto flex items-center gap-2">
                                                                                                            <button
                                                                                                                onClick={() => {
                                                                                                                    // Try to switch to System Status panel if available in app shell via custom event
                                                                                                                    try { window.dispatchEvent(new CustomEvent('open-system-status')); } catch {}
                                                                                                                    // Fallback: small hint
                                                                                                                }}
                                                                                                                className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
                                                                                                            >Configure</button>
                                                                                                            <button
                                                                                                                onClick={() => { navigator.clipboard.writeText('VITE_HF_API_TOKEN=your_token_here'); }}
                                                                                                                className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
                                                                                                                title="Copy env snippet"
                                                                                                            >Copy env</button>
                                                                                                            <button
                                                                                                                onClick={() => { try { sessionStorage.setItem('hide_hf_helper', '1'); } catch {} setShowHfHelper(false); }}
                                                                                                                className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                                                                                                aria-label="Dismiss"
                                                                                                            >&times;</button>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                )}
                    </div>
                    {/* Hugging Face token management moved to System Status panel */}
                     <div>
                        <label className="text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Style Preset</label>
                        <select value={style} onChange={e => updateSetting('style', e.target.value as ImageStyle)} className="w-full p-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm">
                            <option value="none">None (Default)</option>
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
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Aspect Ratio</label>
                        <SegmentedControl
                            options={[
                              {id: '1:1', label: '1:1', tooltip: "Square"},
                              {id: '16:9', label: '16:9', tooltip: "Landscape"},
                              {id: '9:16', label: '9:16', tooltip: "Portrait"},
                              {id: '4:3', label: '4:3', tooltip: "Classic"},
                              {id: '3:2', label: '3:2', tooltip: "Photo"},
                              {id: '2:3', label: '2:3', tooltip: "Photo Tall"},
                              {id: '21:9', label: '21:9', tooltip: "Ultra-wide"},
                              {id: '9:21', label: '9:21', tooltip: "Ultra-tall"},
                              {id: '5:4', label: '5:4', tooltip: "Near square"},
                            ]}
                            selected={aspectRatio}
                            setSelected={(val) => updateSetting('aspectRatio', val as AspectRatio)}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Format</label>
                        <select value={settings.format} onChange={e => { const fmt = e.target.value as ImageFormat; setSettings(s => ({...s, format: fmt})); updateGlobalSettings({ imageFormat: fmt }); }} className="w-full p-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm">
                            <option value="png">PNG (lossless)</option>
                            <option value="jpeg">JPEG (compressed)</option>
                            <option value="webp">WebP (modern)</option>
                        </select>
                    </div>
                </div>
                <button 
                    onClick={() => handleGenerate(prompt, model, style, aspectRatio)} 
                    disabled={isLoading || !prompt.trim() || (coolingDown && model !== 'huggingface')}
                    className="mt-4 w-full px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-opacity-50 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors text-sm font-semibold flex-shrink-0"
                >
                    {coolingDown && model !== 'huggingface' ? `Cooling down... ${(resumeInMs/1000).toFixed(1)}s` : (isLoading ? 'Generating...' : 'Generate Image')}
                </button>
            </div>
            <div className="flex-grow flex flex-col gap-4 overflow-hidden">
                <div className="flex-grow bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg p-3 sm:p-4 flex items-center justify-center min-h-0">
                    {renderResult()}
                </div>
                {/* Diagnostics removed for end-user simplicity; Hugging Face token moved to System Status. */}
                <div className="h-40 sm:h-44 flex-shrink-0 bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg p-3 sm:p-4 flex flex-col">
                     <div className="flex justify-between items-center mb-1 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                            <HistoryIcon className="w-5 h-5"/>
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">History</h3>
                        </div>
                        {history.length > 0 && <button onClick={handleClearHistory} className="text-[11px] text-slate-500 hover:text-red-500 hover:underline flex items-center gap-1"><TrashIcon className="w-3 h-3"/>Clear</button>}
                    </div>
                    <div className="flex-grow overflow-x-auto min-h-0">
                        {history.length > 0 ? (
                             <div className="flex gap-2 h-full">
                                {history.map(entry => <HistoryItem compact key={entry.id} entry={entry} onRegenerate={handleRegenerate} onFavorite={handleFavorite} />)}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-xs text-slate-400 dark:text-slate-500">No history yet.</div>
                        )}
                    </div>
                </div>
                <ConfirmDialog
                  open={showClearDialog}
                  title="Clear Image History"
                  message="Are you sure you want to clear the entire history? This action cannot be undone."
                  confirmLabel="Clear"
                  destructive
                  onConfirm={() => { setHistory([]); setShowClearDialog(false); }}
                  onCancel={() => setShowClearDialog(false)}
                />
            </div>
        </div>
    );
};

const ActionButton: React.FC<{ tooltip: string; onClick: () => void; children: React.ReactNode }> = ({ tooltip, onClick, children }) => (
    <div className="relative group">
        <button onClick={onClick} aria-label={tooltip} className="p-2 text-white rounded-md hover:bg-white/20 transition-colors">{children}</button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            {tooltip}
        </div>
    </div>
);

const SegmentedControl: React.FC<{options: {id: string, label: string, tooltip: string, disabled?: boolean}[], selected: string, setSelected: (id: string) => void}> = ({options, selected, setSelected}) => (
    <div className="flex w-full bg-slate-200 dark:bg-slate-700 rounded-md p-1">
        {options.map(opt => (
             <div key={opt.id} className="relative group w-full">
                <button
                    onClick={() => { if (!opt.disabled) setSelected(opt.id); }}
                    disabled={opt.disabled}
                    className={`w-full text-center text-sm font-medium py-1 rounded transition-colors ${selected === opt.id ? 'bg-white dark:bg-slate-600 shadow text-violet-600 dark:text-violet-300' : opt.disabled ? 'text-slate-400 dark:text-slate-500 opacity-70 cursor-not-allowed' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600/50'}`}
                >
                    {opt.label}
                </button>
                 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    {opt.tooltip}
                </div>
            </div>
        ))}
    </div>
);

const HistoryItem: React.FC<{entry: ImageGenerationHistoryEntry, onRegenerate: (e: ImageGenerationHistoryEntry) => void, onFavorite: (id: string) => void, compact?: boolean}> = ({ entry, onRegenerate, onFavorite, compact = false }) => {
    return (
        <div className={`group relative ${compact ? 'w-20' : 'w-24'} h-full flex-shrink-0 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden cursor-pointer`} onClick={() => onRegenerate(entry)}>
            {entry.result.success && entry.result.url && entry.result.url !== 'local_preview' ? (
                <img src={entry.result.url} alt={entry.prompt} className="w-full h-full object-cover"/>
            ) : !entry.result.success ? (
                <div className="w-full h-full flex items-center justify-center bg-red-100 dark:bg-red-900/50">
                    <ErrorIcon className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} text-red-500`}/>
                </div>
            ) : entry.result.url === 'local_preview' ? (
                <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-700">
                    <ImageIcon className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} text-slate-400`}/>
                </div>
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-700">
                    <ImageIcon className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} text-slate-400`}/>
                </div>
            )}
            <div className={`absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center ${compact ? 'p-1' : 'p-2'}`}>
                 <div className="flex items-center gap-1">
                     <button onClick={(e) => { e.stopPropagation(); onRegenerate(entry); }} className="p-1 text-white hover:bg-white/20 rounded-full" title="Regenerate"><RegenerateIcon className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`}/></button>
                     <button onClick={(e) => { e.stopPropagation(); onFavorite(entry.id); }} className="p-1 text-white hover:bg-white/20 rounded-full" title="Favorite">
                        <StarIcon className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${entry.isFavorite ? 'text-amber-400' : 'text-white'}`}/>
                    </button>
                 </div>
                 <p className={`${compact ? 'text-[10px] mt-1' : 'text-xs mt-2'} text-white truncate w-full text-center`}>{entry.prompt}</p>
            </div>
        </div>
    );
}

export default ImageGeneration;