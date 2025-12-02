import React, { useEffect, useState } from 'react';
import { checkNemotronHealth, isNemotronConfigured } from '@/services/nemotronService';
import { checkGrokHealth, isGrokConfigured } from '@/services/grokService';

const StatusCard: React.FC<{
    title: string;
    status: 'idle' | 'checking' | 'valid' | 'invalid';
    message: string | null;
    lastCheck: string | null;
    latency: number | null;
    onVerify: () => void;
    isConfigured: boolean;
    color: 'green' | 'blue';
}> = ({ title, status, message, lastCheck, latency, onVerify, isConfigured, color }) => {
    const colorClasses = {
        green: {
            bg: 'bg-green-50 dark:bg-green-900/20',
            border: 'border-green-200 dark:border-green-800',
            text: 'text-green-800 dark:text-green-200',
            badge: 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300'
        },
        blue: {
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            border: 'border-blue-200 dark:border-blue-800',
            text: 'text-blue-800 dark:text-blue-200',
            badge: 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
        }
    };

    const c = colorClasses[color];

    return (
        <div className={`p-4 rounded-lg border ${status === 'valid' ? c.border : 'border-slate-200 dark:border-slate-700'} ${status === 'valid' ? c.bg : 'bg-white dark:bg-slate-800'}`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                <span className={`px-2 py-0.5 text-xs rounded-full ${isConfigured ? c.badge : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                    {isConfigured ? 'Configured' : 'Not Configured'}
                </span>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Status:</span>
                    <span className={`font-medium ${status === 'valid' ? 'text-green-600 dark:text-green-400' :
                            status === 'invalid' ? 'text-red-600 dark:text-red-400' :
                                status === 'checking' ? 'text-amber-600 dark:text-amber-400' :
                                    'text-slate-500'
                        }`}>
                        {status === 'idle' ? 'Unknown' :
                            status === 'checking' ? 'Checking...' :
                                status === 'valid' ? 'Operational' : 'Error'}
                    </span>
                </div>

                {latency !== null && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Latency:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">{latency}ms</span>
                    </div>
                )}

                {lastCheck && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Last Check:</span>
                        <span className="text-xs text-slate-500">{lastCheck}</span>
                    </div>
                )}

                {message && status === 'invalid' && (
                    <div className="mt-2 p-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-900/50">
                        {message}
                    </div>
                )}

                <button
                    onClick={onVerify}
                    disabled={!isConfigured || status === 'checking'}
                    className="w-full mt-2 px-3 py-1.5 text-sm font-medium text-white bg-slate-900 dark:bg-slate-700 rounded hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {status === 'checking' ? 'Verifying...' : 'Check Health'}
                </button>
            </div>
        </div>
    );
};

const SystemStatus: React.FC = () => {
    // NVIDIA State
    const [nvidiaStatus, setNvidiaStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
    const [nvidiaMsg, setNvidiaMsg] = useState<string | null>(null);
    const [nvidiaLatency, setNvidiaLatency] = useState<number | null>(null);
    const [nvidiaLastCheck, setNvidiaLastCheck] = useState<string | null>(null);

    // Grok State
    const [grokStatus, setGrokStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
    const [grokMsg, setGrokMsg] = useState<string | null>(null);
    const [grokLatency, setGrokLatency] = useState<number | null>(null);
    const [grokLastCheck, setGrokLastCheck] = useState<string | null>(null);

    const checkNvidia = async () => {
        if (!isNemotronConfigured()) return;
        setNvidiaStatus('checking');
        setNvidiaMsg(null);
        const start = performance.now();
        const res = await checkNemotronHealth();
        const end = performance.now();
        setNvidiaLatency(Math.round(end - start));
        setNvidiaLastCheck(new Date().toLocaleTimeString());

        if (res.ok) {
            setNvidiaStatus('valid');
        } else {
            setNvidiaStatus('invalid');
            setNvidiaMsg(res.message || 'Unknown error');
        }
    };

    const checkGrok = async () => {
        if (!isGrokConfigured()) return;
        setGrokStatus('checking');
        setGrokMsg(null);
        const start = performance.now();
        const res = await checkGrokHealth();
        const end = performance.now();
        setGrokLatency(Math.round(end - start));
        setGrokLastCheck(new Date().toLocaleTimeString());

        if (res.ok) {
            setGrokStatus('valid');
        } else {
            setGrokStatus('invalid');
            setGrokMsg(res.message || 'Unknown error');
        }
    };

    // Initial check
    useEffect(() => {
        checkNvidia();
        checkGrok();
    }, []);

    return (
        <div className="h-full flex flex-col p-4 overflow-y-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">System Status</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Monitor the health of connected AI providers.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatusCard
                    title="NVIDIA Nemotron"
                    status={nvidiaStatus}
                    message={nvidiaMsg}
                    lastCheck={nvidiaLastCheck}
                    latency={nvidiaLatency}
                    onVerify={checkNvidia}
                    isConfigured={isNemotronConfigured()}
                    color="green"
                />
                <StatusCard
                    title="xAI Grok"
                    status={grokStatus}
                    message={grokMsg}
                    lastCheck={grokLastCheck}
                    latency={grokLatency}
                    onVerify={checkGrok}
                    isConfigured={isGrokConfigured()}
                    color="blue"
                />
            </div>

            <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Provider Capabilities</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                        <div className="font-medium text-green-700 dark:text-green-400 mb-1">NVIDIA Nemotron</div>
                        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1">
                            <li>Text Generation (Llama-3.1-Nemotron-70B)</li>
                            <li>Chat & Reasoning</li>
                            <li>Vision Analysis (Nemotron-Nano-12B-VL)</li>
                        </ul>
                    </div>
                    <div>
                        <div className="font-medium text-blue-700 dark:text-blue-400 mb-1">xAI Grok</div>
                        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1">
                            <li>Image Generation (Grok-2-Image)</li>
                            <li>Prompt Enhancement</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemStatus;
