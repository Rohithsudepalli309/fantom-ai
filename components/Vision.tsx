import React, { useState, useCallback } from 'react';
import { generateTextFromImage } from '../services/geminiService';
import { useRateLimitStatus } from '@/hooks/useRateLimitStatus';
import { type VisionResponse, type VisionSuccess, type VisionError } from '../types';
import { ImageIcon, ErrorIcon, SparklesIcon, DownloadIcon, PlayIcon, StopIcon } from './Icons';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useSettings } from '@/contexts/SettingsContext';

const samplePrompts = [
    "What is the main subject of this image?",
    "Describe the colors and lighting in this picture.",
    "What emotions does this image evoke?",
    "Extract any text visible in this image.",
];

const Vision: React.FC = () => {
    const { settings: globalSettings } = useSettings();
    const [prompt, setPrompt] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [result, setResult] = useState<VisionResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const { coolingDown, resumeInMs } = useRateLimitStatus();
    const { isSpeaking, speak, stop, hasSupport: hasTTSSupport, voices, selectedVoiceName, setSelectedVoiceName } = useTextToSpeech();
    
    const processFile = (file: File) => {
        setError(null);
        setResult(null);

        if (file.size > 4 * 1024 * 1024) { // 4MB limit
            setError("File is too large. Please select an image under 4MB.");
            return;
        }
        if (!file.type.startsWith('image/')) {
            setError("Invalid file type. Please select an image.");
            return;
        }

        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleImageChange = (event: any) => {
        const file = event.target.files?.[0];
        if (file) {
           processFile(file);
        }
    };
    
    const handleDragEnter = useCallback((e: any) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);
    const handleDragLeave = useCallback((e: any) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);
    const handleDragOver = useCallback((e: any) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);
    const handleDrop = useCallback((e: any) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if(file) {
            processFile(file);
        }
    }, []);


    const handleGenerate = async () => {
        if (!prompt.trim() || !imageFile || !imagePreview) {
            setError("Please provide an image and a prompt.");
            return;
        }
        if (coolingDown) {
            setResult({ success: false, error: `Cooling down. Please wait ${(resumeInMs/1000).toFixed(1)}s before retrying.` });
            return;
        }
        setIsLoading(true);
        setResult(null);
        setError(null);
        
        const base64Data = imagePreview.split(',')[1];
        const mimeType = imageFile.type;
        const response = await generateTextFromImage(prompt, base64Data, mimeType);
        
        setResult(response);
        setIsLoading(false);
    };

    const renderResult = () => {
                if (isLoading) {
            return (
                 <div className="m-auto flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500">
                    <SparklesIcon className="w-12 h-12 text-violet-500 animate-pulse mb-2" />
                    <p>Analyzing image...</p>
                </div>
            );
        }
        
        if (result?.success === true) {
            const successResult = result as VisionSuccess;
                        return (
                            <div className="overflow-y-auto pr-2 w-full">
                                <div className="flex items-center justify-between mb-2">
                                    {hasTTSSupport && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => (isSpeaking ? stop() : speak(successResult.text))}
                                                className={`px-2 py-1 rounded-md text-xs font-semibold ${isSpeaking ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-violet-600 text-white hover:bg-violet-700'}`}
                                                aria-label={isSpeaking ? 'Stop' : 'Read Aloud'}
                                            >
                                                <span className="inline-flex items-center gap-1">
                                                    {isSpeaking ? <StopIcon className="w-4 h-4"/> : <PlayIcon className="w-4 h-4"/>}
                                                    {isSpeaking ? 'Stop' : 'Read Aloud'}
                                                </span>
                                            </button>
                                            {voices && voices.length > 0 && (
                                                <select
                                                    value={selectedVoiceName || ''}
                                                    onChange={(e) => setSelectedVoiceName(e.target.value)}
                                                    className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-1"
                                                    title="Select a more natural voice (prefer Google/Microsoft/Natural/Neural)"
                                                >
                                                    <option value="">Auto (best)</option>
                                                    {voices.map((v, idx) => (
                                                        <option key={idx} value={v.name}>{`${v.name}${v.lang ? ' · ' + v.lang : ''}`}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{successResult.text}</p>
                            </div>
                        );
        }
        
        if (result?.success === false) {
             const errorResult = result as VisionError;
             return (
                <div className="m-auto flex flex-col items-center gap-2 text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <ErrorIcon className="w-8 h-8 text-red-500" />
                    <p className="text-red-600 dark:text-red-300 text-sm font-medium">{errorResult.error}</p>
                </div>
             );
        }

        if (imagePreview) {
            return (
                <div className="text-center text-slate-400 dark:text-slate-500 m-auto">
                    <p className="mb-4">Now ask a question or try one of these!</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {samplePrompts.map((p, i) => (
                            <button key={i} onClick={() => setPrompt(p)} className="p-2 bg-slate-200 dark:bg-slate-700/50 rounded-md hover:bg-slate-300 dark:hover:bg-slate-700 text-left transition-colors">
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            );
        }

        return <div className="text-center text-slate-400 dark:text-slate-500 m-auto">Analysis will appear here.</div>;
    }

    if (!globalSettings.visionEnabled) {
        return (
            <div className="h-full flex items-center justify-center p-4 bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg text-center">
                <div>
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                    <h2 className="text-xl font-semibold mb-1">Vision is disabled</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Enable Vision in Settings to analyze images.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-2 sm:p-4 bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg">
            <header className="mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Vision</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Ask questions about your images.</p>
            </header>
            
            <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 overflow-hidden">
                <div className="flex flex-col min-h-0">
                    <div 
                        className={`flex-grow border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center p-4 relative min-h-[200px] transition-colors ${isDragging ? 'bg-violet-50 dark:bg-violet-900/30' : ''}`}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        {imagePreview ? (
                            <img src={imagePreview} alt="Preview" className="max-h-full max-w-full object-contain rounded-md" />
                        ) : (
                            <div className="text-center text-slate-400 dark:text-slate-500 pointer-events-none">
                                <DownloadIcon className="w-12 h-12 mx-auto mb-2" />
                                <p className="font-semibold">Drop an image here</p>
                                <p className="text-sm">or click to browse</p>
                                <p className="text-xs mt-1">(PNG, JPG, WEBP, etc. up to 4MB)</p>
                            </div>
                        )}
                        <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" aria-label="Upload image"/>
                    </div>
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                     <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What do you want to know about this image?" className="w-full mt-4 p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none text-sm" rows={3}/>
                    <button onClick={handleGenerate} disabled={isLoading || !prompt.trim() || !imageFile || coolingDown} className="mt-2 w-full px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-opacity-50 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors text-sm font-semibold">
                        {coolingDown ? `Cooling down... ${(resumeInMs/1000).toFixed(1)}s` : (isLoading ? 'Analyzing...' : 'Analyze Image')}
                    </button>
                </div>

                <div className="flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/50 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                    {renderResult()}
                </div>
            </div>
        </div>
    );
};

export default Vision;