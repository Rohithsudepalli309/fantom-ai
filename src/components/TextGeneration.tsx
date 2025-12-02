import React, { useState, useEffect } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { unifiedGenerateText, unifiedGenerateJson } from '../services/providerService';
import { type TextGenerationHistoryEntry, type JsonGenerationResponse, type TextGenerationResponse, TextModel, Tone, Length, type TextGenerationError, type JsonGenerationError } from '../types';
import PromptLibrary from './PromptLibrary';
import JsonOutput from './JsonOutput';
import {
    ErrorIcon, SparklesIcon, LibraryIcon, HistoryIcon, ChevronDownIcon,
    ThumbsUpIcon, ThumbsDownIcon, RegenerateIcon, ShareIcon, DownloadIcon,
    StarIcon, CheckIcon, WebIcon, CopyIcon,
    MicrophoneIcon, PlayIcon, StopIcon, TrashIcon
} from './Icons';
import { useToast } from '@/components/Toaster';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useSettings } from '@/contexts/SettingsContext';

interface LocalTextGenerationState {
    prompt: string;
    systemPrompt: string;
    model: TextModel;
    tone: Tone;
    length: Length;
    isJsonMode: boolean;
    useWebSearch: boolean;
}

const initialState: LocalTextGenerationState = {
    prompt: '',
    systemPrompt: '',
    model: 'nvidia/nemotron-nano-12b-v2-vl', // Default to Nemotron
    tone: 'casual',
    length: 'medium',
    isJsonMode: false,
    useWebSearch: false,
};

const TextGeneration: React.FC = () => {
    const toast = useToast();
    const { settings: globalSettings, updateSettings: updateGlobalSettings } = useSettings();
    const [local, setLocal] = useState<LocalTextGenerationState>(() => ({
        ...initialState,
        // model: globalSettings.chatModel as TextModel, // Removed dependency on global settings for model
    }));
    const [result, setResult] = useState<TextGenerationResponse | JsonGenerationResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const { prompt, systemPrompt, model, tone, length, isJsonMode, useWebSearch } = local;
    const temperature = globalSettings.temperature;

    const [history, setHistory] = useState<TextGenerationHistoryEntry[]>(() => {
        try {
            const savedHistory = localStorage.getItem('textGenerationHistory_v2');
            return savedHistory ? JSON.parse(savedHistory) : [];
        } catch (error) {
            console.error("Failed to parse text generation history:", error);
            return [];
        }
    });

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(false);
    const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
    const [showClearDialog, setShowClearDialog] = useState(false);

    const { isSpeaking, speak, stop, hasSupport: hasTTSSupport } = useTextToSpeech();
    const { isListening, transcript, startListening, stopListening, hasSupport: hasVoiceSupport } = useVoiceRecognition();

    useEffect(() => {
        try {
            localStorage.setItem('textGenerationHistory_v2', JSON.stringify(history));
        } catch (error) {
            console.error("Failed to save text generation history:", error);
        }
    }, [history]);

    useEffect(() => {
        if (transcript) {
            updateSetting('prompt', local.prompt + transcript);
        }
    }, [transcript]);

    const updateSetting = <K extends keyof LocalTextGenerationState>(key: K, value: LocalTextGenerationState[K]) => {
        setLocal(s => ({ ...s, [key]: value }));
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsLoading(true);
        setResult(null);

        let response: TextGenerationResponse | JsonGenerationResponse;
        if (isJsonMode) {
            response = await unifiedGenerateJson(prompt);
        } else {
            const fullSystemPrompt = `${systemPrompt} The user wants a response that is ${tone} in tone and ${length} in length.`;
            response = await unifiedGenerateText(prompt, model, fullSystemPrompt, temperature, useWebSearch);
        }

        setResult(response);
        setIsLoading(false);

        const newHistoryEntry: TextGenerationHistoryEntry = {
            id: `text-${Date.now()}`,
            timestamp: new Date().toISOString(),
            prompt,
            result: response,
            model, tone, length, temperature, systemPrompt, isJsonMode, useWebSearch,
            isFavorite: false,
        };
        setHistory(prev => [newHistoryEntry, ...prev]);
    };

    const handleRegenerateFromHistory = (entry: TextGenerationHistoryEntry) => {
        setLocal({
            prompt: entry.prompt,
            systemPrompt: entry.systemPrompt,
            model: entry.model,
            tone: entry.tone,
            length: entry.length,
            isJsonMode: entry.isJsonMode,
            useWebSearch: entry.useWebSearch,
        });

        setTimeout(() => handleGenerate(), 0);
    }

    const handleRegenerateCurrent = () => {
        if (history.length > 0) {
            handleRegenerateFromHistory(history[0]);
        }
    }

    const handleFeedback = (feedback: 'good' | 'bad', entryId: string) => {
        const updatedHistory = history.map((entry) => {
            if (entry.id === entryId) {
                const newFeedback = entry.feedback === feedback ? null : feedback;
                return { ...entry, feedback: newFeedback };
            }
            return entry;
        });
        setHistory(updatedHistory);
    };

    const handleFavorite = (id: string) => {
        setHistory(history.map(entry =>
            entry.id === id ? { ...entry, isFavorite: !entry.isFavorite } : entry
        ));
    }

    const handleShare = (textToCopy: string) => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            setShareState('copied');
            toast.show({ variant: 'success', message: 'Copied to clipboard.' });
            setTimeout(() => setShareState('idle'), 1800);
        }).catch(() => toast.show({ variant: 'error', message: 'Failed to copy.' }));
    };

    const handleDownload = (content: string) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fantom-ai-text.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleClearHistory = () => {
        setShowClearDialog(true);
    };

    const renderResult = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center text-slate-500 dark:text-slate-400">
                        <SparklesIcon className="w-12 h-12 mx-auto animate-pulse text-violet-500" />
                        <p className="mt-2">Generating response...</p>
                    </div>
                </div>
            );
        }

        if (!result) {
            return <div className="text-center text-slate-400 dark:text-slate-500 m-auto">Your generated text will appear here.</div>;
        }

        if (result.success === true) {
            const textResult = 'text' in result ? result.text : null;
            const jsonResult = 'json' in result ? result.json : null;
            const sources = 'sources' in result ? result.sources : null;

            return (
                <div className="h-full flex flex-col">
                    <div className="flex-grow overflow-y-auto space-y-4 pr-2">
                        {jsonResult && (
                            <div className="relative group">
                                <JsonOutput jsonString={JSON.stringify(jsonResult, null, 2)} />
                                <div className="absolute top-2 right-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ActionButton tooltip={shareState === 'copied' ? 'Copied!' : 'Copy JSON'} onClick={() => handleShare(JSON.stringify(jsonResult, null, 2))}>
                                        {shareState === 'copied' ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                                    </ActionButton>
                                </div>
                            </div>
                        )}
                        {textResult && (
                            <div className="relative group">
                                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{textResult}</p>
                                <div className="absolute top-2 right-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ActionButton tooltip={shareState === 'copied' ? 'Copied!' : 'Copy'} onClick={() => handleShare(textResult)}>
                                        {shareState === 'copied' ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                                    </ActionButton>
                                </div>
                            </div>
                        )}
                        {sources && sources.length > 0 && (
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"><WebIcon className="w-4 h-4" /> Sources</h4>
                                <div className="mt-2 space-y-1">
                                    {sources.map((source, index) => source.web?.uri && (
                                        <a href={source.web.uri} target="_blank" rel="noopener noreferrer" key={index} className="block text-xs text-violet-600 dark:text-violet-400 hover:underline truncate">
                                            {source.web.title || source.web.uri}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex-shrink-0 pt-2 mt-2 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ActionButton tooltip="Regenerate" onClick={handleRegenerateCurrent}>
                                <RegenerateIcon className="w-5 h-5" />
                            </ActionButton>
                            <ActionButton tooltip={shareState === 'copied' ? 'Copied!' : 'Share'} onClick={() => handleShare(textResult || JSON.stringify(jsonResult, null, 2))}>
                                {shareState === 'copied' ? <CheckIcon className="w-5 h-5 text-green-500" /> : <ShareIcon className="w-5 h-5" />}
                            </ActionButton>
                            <ActionButton tooltip="Download" onClick={() => handleDownload(textResult || JSON.stringify(jsonResult, null, 2))}>
                                <DownloadIcon className="w-5 h-5" />
                            </ActionButton>
                        </div>
                        <div className="flex items-center gap-2">
                            {textResult && hasTTSSupport && (
                                <ActionButton tooltip={isSpeaking ? "Stop" : "Read Aloud"} onClick={() => isSpeaking ? stop() : speak(textResult)}>
                                    {isSpeaking ? <StopIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                                </ActionButton>
                            )}
                            <ActionButton tooltip="Good" onClick={() => handleFeedback('good', history[0]?.id)} active={history[0]?.feedback === 'good'}>
                                <ThumbsUpIcon className="w-5 h-5" />
                            </ActionButton>
                            <ActionButton tooltip="Bad" onClick={() => handleFeedback('bad', history[0]?.id)} active={history[0]?.feedback === 'bad'}>
                                <ThumbsDownIcon className="w-5 h-5" />
                            </ActionButton>
                        </div>
                    </div>
                </div>
            );
        }

        const errorResult = result as TextGenerationError | JsonGenerationError;
        return (
            <div className="m-auto flex flex-col items-center gap-2 text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg max-w-full">
                <ErrorIcon className="w-8 h-8 text-red-500" />
                <p className="text-red-600 dark:text-red-300 text-sm font-medium">{errorResult.error}</p>
                {'rawResponse' in errorResult && errorResult.rawResponse && (
                    <div className="mt-2 text-left w-full">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Raw model output:</p>
                        <pre className="text-xs p-2 bg-slate-100 dark:bg-slate-800 rounded-md overflow-x-auto w-full">{errorResult.rawResponse}</pre>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-2 sm:p-4 bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg">
            <header className="mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Text Generation</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Turn your ideas into text with a simple prompt.</p>
            </header>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
                <div className="flex flex-col gap-4 overflow-y-auto pr-2">
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Your Prompt</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => updateSetting('prompt', e.target.value)}
                            placeholder="e.g., Write a short story about a robot who discovers music."
                            className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none text-sm"
                            rows={5}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">System Prompt (Optional)</label>
                        <textarea
                            value={systemPrompt}
                            onChange={(e) => updateSetting('systemPrompt', e.target.value)}
                            placeholder="e.g., You are a witty copywriter who specializes in catchy slogans."
                            className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none text-sm"
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Model selector removed */}
                        <div>
                            <label htmlFor="temperature" className="text-sm font-medium text-slate-700 dark:text-slate-300">Creativity (Temp: {temperature.toFixed(2)})</label>
                            <input
                                id="temperature"
                                type="range"
                                min={0}
                                max={2}
                                step={0.01}
                                value={temperature}
                                onChange={(e) => updateGlobalSettings({ temperature: parseFloat(e.target.value) })}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 mt-2"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex-wrap">
                        <div className="flex items-center gap-3">
                            <label htmlFor="json-mode" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">JSON Mode</label>
                            <input type="checkbox" id="json-mode" checked={isJsonMode} onChange={(e) => updateSetting('isJsonMode', e.target.checked)} disabled={useWebSearch} className="toggle" />
                        </div>
                        <div className="flex items-center gap-3">
                            <label htmlFor="web-search" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Web Search</label>
                            <input type="checkbox" id="web-search" checked={useWebSearch} onChange={(e) => updateSetting('useWebSearch', e.target.checked)} disabled={isJsonMode} className="toggle" />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={handleGenerate} disabled={isLoading || !prompt.trim() || isListening} className="flex-grow px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-opacity-50 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors text-sm font-semibold">
                            {isLoading ? 'Generating...' : 'Generate Text'}
                        </button>
                        {hasVoiceSupport && (
                            <ActionButton tooltip={isListening ? 'Stop Listening' : 'Use Microphone'} onClick={isListening ? stopListening : startListening} active={isListening}>
                                <MicrophoneIcon className={`w-5 h-5 ${isListening ? 'text-red-500 animate-pulse' : ''}`} />
                            </ActionButton>
                        )}
                        <ActionButton tooltip="Prompt Library" onClick={() => setIsPromptLibraryOpen(true)} active={isPromptLibraryOpen}>
                            <LibraryIcon className="w-5 h-5" />
                        </ActionButton>
                    </div>
                    {isPromptLibraryOpen && (
                        <div className="mt-2 relative">
                            <PromptLibrary onSelectPrompt={(p) => { updateSetting('prompt', p); setIsPromptLibraryOpen(false); }} />
                            <button onClick={() => setIsPromptLibraryOpen(false)} className="absolute top-2 right-2 p-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">&times;</button>
                        </div>
                    )}

                    <div className="mt-4 border-t border-slate-200 dark:border-slate-700/50 pt-4">
                        <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="w-full flex justify-between items-center text-left text-lg font-bold text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-2">
                                <HistoryIcon className="w-6 h-6" />
                                <span>History</span>
                            </div>
                            <ChevronDownIcon className={`w-5 h-5 transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isHistoryOpen && (
                            <div className="mt-4 space-y-2 max-h-96 overflow-y-auto pr-2">
                                {history.length > 0 ? (
                                    <>
                                        <button onClick={handleClearHistory} className="text-xs text-slate-500 hover:text-red-500 hover:underline flex items-center gap-1"><TrashIcon className="w-3 h-3" />Clear all</button>
                                        {history.map(entry => (
                                            <div key={entry.id}>
                                                <HistoryItem entry={entry} onRegenerate={handleRegenerateFromHistory} onFavorite={handleFavorite} onFeedback={handleFeedback} />
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No history yet.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/50 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                    {renderResult()}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-auto pt-2 text-center flex-shrink-0">FANTOM AI can make mistakes. Consider checking important information.</p>
                </div>
            </div>
            <ConfirmDialog
                open={showClearDialog}
                title="Clear History"
                message="Are you sure you want to clear the entire history? This action cannot be undone."
                confirmLabel="Clear"
                destructive
                onConfirm={() => { setHistory([]); setIsHistoryOpen(false); setShowClearDialog(false); }}
                onCancel={() => setShowClearDialog(false)}
            />
        </div>
    );
};

// Use a simplified onClick type to avoid dependency on React.MouseEventHandler not present in minimal react.d.ts
const ActionButton: React.FC<{ tooltip: string; onClick: (e: any) => void; active?: boolean; children: React.ReactNode }> = ({ tooltip, onClick, active, children }) => (
    <div className="relative group">
        <button
            onClick={onClick}
            aria-label={tooltip}
            className={`p-2.5 rounded-lg transition-colors ${active ? 'bg-violet-200 dark:bg-violet-800/60 text-violet-700 dark:text-violet-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
        >
            {children}
        </button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            {tooltip}
        </div>
    </div>
);

const SegmentedControl: React.FC<{ options: { id: string, label: string, tooltip: string }[], selected: string, setSelected: (id: string) => void }> = ({ options, selected, setSelected }) => (
    <div className="flex w-full bg-slate-200 dark:bg-slate-700 rounded-md p-1">
        {options.map(opt => (
            <div key={opt.id} className="relative group w-full">
                <button
                    onClick={() => setSelected(opt.id)}
                    className={`w-full text-center text-sm font-medium py-1 rounded transition-colors ${selected === opt.id ? 'bg-white dark:bg-slate-600 shadow text-violet-600 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600/50'}`}
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

const HistoryItem: React.FC<{ entry: TextGenerationHistoryEntry, onRegenerate: (e: TextGenerationHistoryEntry) => void, onFavorite: (id: string) => void, onFeedback: (f: 'good' | 'bad', id: string) => void }> = ({ entry, onRegenerate, onFavorite, onFeedback }) => {
    return (
        <div className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
            <p className="text-sm font-medium truncate text-slate-700 dark:text-slate-300">{entry.prompt}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(entry.timestamp).toLocaleString()}</p>
            <div className="flex items-center gap-2 mt-2">
                <ActionButton tooltip="Load & Regenerate" onClick={() => onRegenerate(entry)}><RegenerateIcon className="w-4 h-4" /></ActionButton>
                <ActionButton tooltip="Favorite" onClick={() => onFavorite(entry.id)} active={entry.isFavorite}>
                    <StarIcon className={`w-4 h-4 ${entry.isFavorite ? 'text-amber-500' : ''}`} />
                </ActionButton>
                <ActionButton tooltip="Good" onClick={() => onFeedback('good', entry.id)} active={entry.feedback === 'good'}><ThumbsUpIcon className="w-4 h-4" /></ActionButton>
                <ActionButton tooltip="Bad" onClick={() => onFeedback('bad', entry.id)} active={entry.feedback === 'bad'}><ThumbsDownIcon className="w-4 h-4" /></ActionButton>
            </div>
        </div>
    )
}

const style = document.createElement('style');
style.innerHTML = `
.toggle {
  -webkit-appearance: none;
  appearance: none;
  width: 32px;
  height: 20px;
  background-color: #cbd5e1; /* slate-300 */
  border-radius: 9999px;
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
}
.dark .toggle {
    background-color: #475569; /* slate-600 */
}
.toggle:checked {
  background-color: #8b5cf6; /* violet-500 */
}
.toggle::before {
  content: '';
  width: 14px;
  height: 14px;
  background-color: white;
  border-radius: 9999px;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: transform 0.2s ease-in-out;
}
.toggle:checked::before {
  transform: translateX(12px);
}
.toggle:disabled {
    cursor: not-allowed;
    background-color: #e2e8f0; /* slate-200 */
}
.dark .toggle:disabled {
    background-color: #334155; /* slate-700 */
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #8b5cf6; /* violet-500 */
  cursor: pointer;
  border-radius: 50%;
}
input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #8b5cf6;
  cursor: pointer;
  border-radius: 50%;
  border: none;
}
`;
document.head.appendChild(style);


export default TextGeneration;