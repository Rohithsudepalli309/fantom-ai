import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import ConfirmDialog from '@/components/ConfirmDialog';
import { unifiedChatStream, getActiveProvider } from '../services/providerService';
import { type ChatMessage, type TextModel, GroundingChunk, Feedback } from '../types';
import {
    SendIcon, ErrorIcon, ChatIcon, ThumbsUpIcon, ThumbsDownIcon,
    CopyIcon, CheckIcon, RegenerateIcon, EditIcon, WebIcon,
    MicrophoneIcon, LibraryIcon, TrashIcon
} from './Icons';
import { Logo } from './Logo';
import Markdown from './Markdown';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import PromptLibrary from './PromptLibrary';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { getChatPersistence } from '@/services/chatPersistence';
import { useToast } from '@/components/Toaster';
import { recordActivitySafe } from '@/services/storageService';

const Chat: React.FC = () => {
    const toast = useToast();
    const { settings } = useSettings();
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

    // Load history on mount
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (!user || !settings.chatHistoryEnabled) {
                if (mounted) { setMessages([]); setIsHistoryLoaded(true); }
                return;
            }
            try {
                const persistence = await getChatPersistence();
                const history = await persistence.loadHistory(user.uid);
                if (mounted) {
                    setMessages(history);
                    setIsHistoryLoaded(true);
                }
            } catch (e) {
                console.error("Failed to load history", e);
                if (mounted) setIsHistoryLoaded(true);
            }
        };
        load();
        return () => { mounted = false; };
    }, [user, settings.chatHistoryEnabled]);

    // Save history on change
    useEffect(() => {
        if (!isHistoryLoaded || !user) return;
        const save = async () => {
            try {
                const persistence = await getChatPersistence();
                if (settings.chatHistoryEnabled) {
                    await persistence.saveHistory(user.uid, messages);
                } else {
                    await persistence.clearHistory(user.uid);
                }
            } catch (e) { console.error("Failed to save history", e); }
        };
        // Debounce save slightly to avoid thrashing
        const timeout = setTimeout(save, 1000);
        return () => clearTimeout(timeout);
    }, [messages, settings.chatHistoryEnabled, user, isHistoryLoaded]);

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [model, setModel] = useState<TextModel>('nvidia/nemotron-nano-12b-v2-vl');
    const [useWebSearch, setUseWebSearch] = useState(false);
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [editingText, setEditingText] = useState("");
    const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(false);
    const [showNewChatDialog, setShowNewChatDialog] = useState(false);
    const pendingActionRef = useRef<(() => void) | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const { isListening, transcript, startListening, stopListening, hasSupport: hasVoiceSupport } = useVoiceRecognition();

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    useEffect(() => {
        if (transcript) {
            setInput(prev => prev + transcript);
        }
    }, [transcript]);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(160, inputRef.current.scrollHeight)}px`;
        }
    }, [input]);

    // Hidden real-time detector: enables web search per-message when the user asks for timely info
    const needsRealtime = (text: string): boolean => {
        const t = text.toLowerCase();
        // Explicit opt-out
        if (/(no web|offline only|don'?t use (the )?web|no internet)/i.test(text)) return false;
        // Strong indicators
        const keywords = [
            'today', 'yesterday', 'right now', 'currently', 'latest', 'breaking', 'just happened',
            'news', 'headlines', 'weather', 'forecast', 'traffic', 'stock', 'price', 'market',
            'score', 'scores', 'match', 'live', 'stream', 'release date', 'when is', 'schedule',
            'update', 'trending', 'earnings', 'ipo', 'exchange rate', 'currency rate', 'bitcoin', 'eth',
            'flight status', 'covid', 'earthquake', 'alert'
        ];
        if (keywords.some(k => t.includes(k))) return true;
        // Year mention near present/future often implies recency
        const thisYear = new Date().getFullYear();
        if (/(\b20\d{2}\b)/.test(t)) {
            const yr = parseInt((t.match(/\b20\d{2}\b/) || [])[0] || '0', 10);
            if (yr >= thisYear - 1) return true;
        }
        // Specific patterns: “what happened” + entity
        if (/what happened|who won|is it out|is it released|is it available|when did/i.test(text)) return true;
        return false;
    };

    const handleSend = async (messageToSend?: string, historyToUse?: ChatMessage[]) => {
        const currentMessage = messageToSend || input;
        if (!currentMessage.trim()) return;
        // Keep input ergonomics simple; no token counter UI.

        const userMessage: ChatMessage = { role: 'user', content: currentMessage };
        const baseMessages = historyToUse || messages;
        const newMessages: ChatMessage[] = [...baseMessages, userMessage];

        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        let modelResponse = '';
        let sources: GroundingChunk[] = [];
        let hasReceivedChunk = false;
        // Hidden real-time toggle: only for this message, don't flip the visible switch
        const enableRealtimeForThisMessage = useWebSearch || needsRealtime(currentMessage);
        // Activity: log user message (fire-and-forget)
        if (user) {
            recordActivitySafe(user.uid, 'chat.message', {
                role: 'user',
                length: currentMessage.length,
                useWebSearch: enableRealtimeForThisMessage,
                model
            });
        }

        try {
            const stream = unifiedChatStream(baseMessages, currentMessage, model, enableRealtimeForThisMessage);
            for await (const chunk of stream) {
                if (chunk.success && chunk.text) {
                    if (!hasReceivedChunk) {
                        hasReceivedChunk = true;
                        setMessages(prev => [...prev, { role: 'model', content: '' }]);
                    }
                    modelResponse += chunk.text;
                    if (chunk.sources && chunk.sources.length > 0) {
                        const currentSourceUris = new Set(sources.map(s => s.web?.uri));
                        for (const newSource of chunk.sources) {
                            if (newSource.web?.uri && !currentSourceUris.has(newSource.web.uri)) {
                                sources.push(newSource);
                                currentSourceUris.add(newSource.web.uri);
                            }
                        }
                    }

                    setMessages(s => {
                        const updatedMessages = [...s];
                        if (updatedMessages.length > 0 && updatedMessages[updatedMessages.length - 1].role === 'model') {
                            updatedMessages[updatedMessages.length - 1].content = modelResponse;
                            updatedMessages[updatedMessages.length - 1].sources = sources;
                        }
                        return updatedMessages;
                    });
                } else if (!chunk.success) {
                    const errorMsg = chunk.error || "An unknown error occurred.";
                    setMessages(prev => [...prev.slice(0, -1), { role: 'model', content: errorMsg, isError: true }]);
                    break;
                }
            }
        } catch (e: any) {
            const errorMsg = e.message || "Failed to get response from the model.";
            setMessages(prev => [...prev.slice(0, -1), { role: 'model', content: errorMsg, isError: true }]);
            if (user) {
                recordActivitySafe(user.uid, 'chat.message', {
                    role: 'model',
                    isError: true,
                    error: errorMsg,
                    model,
                });
            }
        } finally {
            setIsLoading(false);
            // Activity: log assistant reply summary once finished if not error
            if (user && !hasReceivedChunk && modelResponse.length === 0) {
                // no response generated (likely error already logged)
            } else if (user) {
                recordActivitySafe(user.uid, 'chat.message', {
                    role: 'model',
                    length: modelResponse.length,
                    sourcesCount: sources.length,
                    model,
                });
            }
            // Optional desktop notification when reply is ready and app is in background
            try {
                if (settings.notifications && typeof document !== 'undefined' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification('FANTOM AI', { body: 'Reply is ready.' });
                }
            } catch {/* ignore */ }
        }
    };

    // Use a minimal event type to avoid conflicts with our custom React type stubs
    const handleKeyDown = (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        // Ctrl+K clears input quickly
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            setInput('');
        }
    };

    const handleFeedback = (index: number, feedback: Feedback) => {
        setMessages(msgs => msgs.map((msg, i) => i === index ? { ...msg, feedback: msg.feedback === feedback ? null : feedback } : msg));
    };

    const handleCopy = (index: number) => {
        const msg = messages[index];
        const messageToCopy = msg.content;
        navigator.clipboard.writeText(messageToCopy).then(() => {
            setMessages(msgs => msgs.map((m, i) => i === index ? { ...m, shareState: 'copied' } : m));
            toast.show({
                variant: 'success',
                message: msg.role === 'user' ? 'Copied your message.' : 'Copied assistant message.',
                duration: 2200,
            });
            setTimeout(() => {
                setMessages(msgs => msgs.map((m, i) => i === index ? { ...m, shareState: 'idle' } : m));
            }, 1800);
        }).catch(() => {
            toast.show({ variant: 'error', message: 'Failed to copy.' });
        });
    };

    const handleRegenerate = () => {
        let lastUserMessageIndex = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                lastUserMessageIndex = i;
                break;
            }
        }

        if (lastUserMessageIndex !== -1) {
            const historyToResend = messages.slice(0, lastUserMessageIndex);
            const messageToResend = messages[lastUserMessageIndex].content;
            setMessages(messages.slice(0, lastUserMessageIndex));
            // Timeout to allow state to update before sending
            setTimeout(() => handleSend(messageToResend, historyToResend), 0);
        }
    };

    const handleEdit = (index: number) => {
        setEditingMessageIndex(index);
        setEditingText(messages[index].content);
    };

    const handleSaveEdit = (index: number) => {
        const historyBeforeEdit = messages.slice(0, index);
        setEditingMessageIndex(null);
        handleSend(editingText, historyBeforeEdit);
        setEditingText("");
    };

    const handleCancelEdit = () => {
        setEditingMessageIndex(null);
        setEditingText("");
    };

    const requestNewChat = (action?: () => void) => {
        if (messages.length === 0) {
            if (action) action(); else setMessages([]);
            return;
        }
        pendingActionRef.current = action || (() => setMessages([]));
        setShowNewChatDialog(true);
    };

    const confirmNewChat = () => {
        pendingActionRef.current?.();
        pendingActionRef.current = null;
        setShowNewChatDialog(false);
    };

    const cancelNewChat = () => {
        pendingActionRef.current = null;
        setShowNewChatDialog(false);
    };

    const activeProvider = 'nemotron';

    return (
        <div className="h-full flex flex-col p-2 sm:p-4 bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg">
            <header className="mb-4 flex-shrink-0 pb-3 border-b border-slate-200 dark:border-slate-700/60">
                <div className="flex items-start gap-2 flex-wrap">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Chat <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded bg-violet-100 dark:bg-violet-800/40 text-violet-700 dark:text-violet-300 uppercase tracking-wide">Nemotron</span></h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">Have a conversation with the AI.
                            <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-violet-100 dark:bg-violet-800/40 text-violet-700 dark:text-violet-300 uppercase tracking-wide" title="Active provider">Nemotron</span>
                        </p>
                    </div>
                    {/* Right-aligned toolbar controls */}
                    <div className="ml-auto w-full sm:w-auto flex items-center justify-end gap-2 sm:gap-3 flex-wrap">
                        <div className="flex items-center gap-2" title="Enable web search for fresher answers">
                            <label htmlFor="web-search-chat" className="text-sm font-medium">Web Search</label>
                            <input
                                type="checkbox"
                                id="web-search-chat"
                                checked={useWebSearch}
                                onChange={(e) => {
                                    const next = e.target.checked;
                                    requestNewChat(() => { setUseWebSearch(next); setMessages([]); });
                                }}
                                className="toggle"
                            />
                        </div>
                        <button onClick={() => requestNewChat()} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700" aria-label="Clear chat">
                            <TrashIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-grow flex flex-col overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50 space-y-4">
                {messages.length === 0 && !isLoading && (
                    <div className="m-auto text-center text-slate-400 dark:text-slate-500">
                        <ChatIcon className="w-12 h-12 mx-auto mb-2" />
                        <p>Send a message to start the conversation.</p>
                    </div>
                )}
                {messages.map((msg, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="animate-msgAppear"
                    >
                        {msg.role === 'user' ? (
                            <div className="group flex justify-end">
                                <div className="flex items-end gap-2 max-w-xl">
                                    <div className="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <ActionButton small tooltip="Copy" onClick={() => handleCopy(index)}>
                                            {messages[index].shareState === 'copied' ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                                        </ActionButton>
                                        <ActionButton small tooltip="Edit" onClick={() => handleEdit(index)}>
                                            <EditIcon className="w-4 h-4" />
                                        </ActionButton>
                                    </div>
                                    {editingMessageIndex === index ? (
                                        <div className="w-full">
                                            <textarea
                                                value={editingText}
                                                onChange={(e) => setEditingText(e.target.value)}
                                                className="w-full p-2 border border-violet-500 rounded-md bg-slate-100 dark:bg-slate-800"
                                                rows={3}
                                            />
                                            <div className="flex gap-2 mt-1 justify-end">
                                                <button onClick={handleCancelEdit} className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700">Cancel</button>
                                                <button onClick={() => handleSaveEdit(index)} className="text-xs px-2 py-1 rounded bg-violet-600 text-white">Save & Resend</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-violet-600 text-white p-3 rounded-lg text-sm whitespace-pre-wrap">{msg.content}</div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className={`flex gap-3 justify-start group ${msg.isError ? 'items-center' : 'items-start'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.isError ? 'bg-red-100 dark:bg-red-900/50' : 'bg-violet-200 dark:bg-violet-900/50'}`}>
                                    {msg.isError ? <ErrorIcon className="w-5 h-5 text-red-500" /> : <Logo className="w-6 h-6 flex-shrink-0" />}
                                </div>
                                <div className={`max-w-2xl p-3 rounded-lg ${msg.isError ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-slate-200 dark:bg-slate-700'} `}>
                                    {!msg.isError && (
                                        <span className="inline-block mb-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-violet-100 dark:bg-violet-800/40 text-violet-700 dark:text-violet-300 uppercase tracking-wide" title="Provider">{activeProvider}</span>
                                    )}
                                    {msg.isError ? (
                                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                                    ) : (
                                        <Markdown content={msg.content} />
                                    )}
                                    {msg.sources && msg.sources.length > 0 && (
                                        <div className="pt-3 mt-3 border-t border-slate-300 dark:border-slate-600">
                                            <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"><WebIcon className="w-4 h-4" /> Sources</h4>
                                            <div className="mt-2 space-y-1">
                                                {msg.sources.map((source, idx) => source.web?.uri && (
                                                    <a href={source.web.uri} target="_blank" rel="noopener noreferrer" key={idx} className="block text-xs text-violet-600 dark:text-violet-400 hover:underline truncate">
                                                        {source.web.title || source.web.uri}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {!msg.isError && (
                                    <div className="flex items-center gap-1 self-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ActionButton small tooltip={msg.shareState === 'copied' ? 'Copied!' : 'Copy'} onClick={() => handleCopy(index)}>
                                            {msg.shareState === 'copied' ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                                        </ActionButton>
                                        <ActionButton small tooltip="Good" onClick={() => handleFeedback(index, 'good')} active={msg.feedback === 'good'}><ThumbsUpIcon className="w-4 h-4" /></ActionButton>
                                        <ActionButton small tooltip="Bad" onClick={() => handleFeedback(index, 'bad')} active={msg.feedback === 'bad'}><ThumbsDownIcon className="w-4 h-4" /></ActionButton>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                ))}

                {isLoading && (
                    <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-violet-200 dark:bg-violet-900/50 flex items-center justify-center flex-shrink-0"><Logo className="w-6 h-6 flex-shrink-0" /></div>
                        <div className="p-3 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center">
                            <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse [animation-delay:-0.15s] mx-1"></div>
                            <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="mt-4 flex-shrink-0">
                {messages.length > 0 && !isLoading && (
                    <div className="flex justify-end mb-2">
                        <button onClick={handleRegenerate} className="flex items-center gap-2 px-3 py-1 text-xs bg-slate-200 dark:bg-slate-700 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600">
                            <RegenerateIcon className="w-3 h-3" />
                            Regenerate
                        </button>
                    </div>
                )}
                <div className="relative">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 focus-within:ring-2 focus-within:ring-violet-500 relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your message... (Use Markdown; ask for examples, steps, code, or summaries)"
                            className="w-full bg-transparent focus:outline-none resize-none text-sm text-slate-800 dark:text-slate-200 max-h-32 pr-36"
                            rows={1}
                            disabled={isLoading || isListening}
                        />
                        <div className="absolute inset-y-0 right-2 flex items-end gap-2 pb-1">
                            <button onClick={() => setIsPromptLibraryOpen(true)} disabled={isLoading} aria-label="Open prompt library" className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700">
                                <LibraryIcon className="w-5 h-5" />
                            </button>
                            {hasVoiceSupport && (
                                <button onClick={isListening ? stopListening : startListening} disabled={isLoading} aria-label={isListening ? 'Stop listening' : 'Use microphone'} className={`p-2 rounded-md ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                                    <MicrophoneIcon className="w-5 h-5" />
                                </button>
                            )}
                            <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} aria-label="Send message" className="p-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed">
                                <SendIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    {isPromptLibraryOpen && (
                        <div className="absolute bottom-full right-0 mb-2 w-full max-w-md z-10">
                            <PromptLibrary onSelectPrompt={(p) => { setInput(p); setIsPromptLibraryOpen(false); inputRef.current?.focus(); }} />
                            <button onClick={() => setIsPromptLibraryOpen(false)} className="absolute top-2 right-2 p-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">&times;</button>
                        </div>
                    )}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">FANTOM AI can make mistakes. Consider checking important information.</p>
            </div>
            <ConfirmDialog
                open={showNewChatDialog}
                title="Start New Chat"
                message="Are you sure you want to start a new chat? The current conversation will be cleared."
                confirmLabel="Start New Chat"
                destructive
                onConfirm={confirmNewChat}
                onCancel={cancelNewChat}
            />
        </div>
    );
};

const ActionButton: React.FC<{ tooltip: string; onClick: () => void; active?: boolean; small?: boolean; children: React.ReactNode }> = ({ tooltip, onClick, active, small, children }) => (
    <div className="relative group">
        <button
            onClick={onClick}
            aria-label={tooltip}
            className={`rounded-md transition-colors ${small ? 'p-1.5' : 'p-2.5'} ${active ? 'bg-violet-200 dark:bg-violet-800/60 text-violet-700 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
        >
            {children}
        </button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
            {tooltip}
        </div>
    </div>
);

const style = document.createElement('style');
style.innerHTML = `
.toggle {
  -webkit-appearance: none;
  appearance: none;
  width: 32px;
  height: 20px;
  background-color: #cbd5e1;
  border-radius: 9999px;
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
}
.dark .toggle {
    background-color: #475569;
}
.toggle:checked {
  background-color: #8b5cf6;
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
`;
document.head.appendChild(style);

export default Chat;