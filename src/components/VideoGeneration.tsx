import React, { useState } from 'react';
import { unifiedGenerateVideo } from '@/services/providerService';
import { SparklesIcon, ErrorIcon } from './Icons';

const VideoGeneration: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ url?: string; error?: string } | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setResult(null);
        const res = await unifiedGenerateVideo(prompt, { durationSec: 2 });
        setLoading(false);
        if (res.success) {
            setResult({ url: res.url });
        } else {
            setResult({ error: res.error });
        }
    };

    return (
        <div className="h-full flex flex-col p-4">
            <header className="mb-6">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Video Generation</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Create short videos from text descriptions.</p>
            </header>

            <div className="bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg p-6 flex flex-col gap-4 max-w-2xl mx-auto w-full">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the video you want to generate..."
                    className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                    rows={4}
                />
                <button
                    onClick={handleGenerate}
                    disabled={loading || !prompt.trim()}
                    className="px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors font-semibold self-end"
                >
                    {loading ? 'Generating...' : 'Generate Video'}
                </button>
            </div>

            {loading && (
                <div className="mt-8 flex flex-col items-center justify-center text-center">
                    <SparklesIcon className="w-12 h-12 text-violet-500 animate-pulse" />
                    <p className="mt-2 text-slate-500 dark:text-slate-400">Generating video...</p>
                </div>
            )}

            {result && (
                <div className="mt-8 flex justify-center">
                    {result.url ? (
                        <video src={result.url} controls className="max-w-full rounded-lg shadow-lg" />
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-red-500">
                            <ErrorIcon className="w-8 h-8" />
                            <p>{result.error}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VideoGeneration;
