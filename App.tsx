import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
const TextGeneration = React.lazy(() => import('./components/TextGeneration'));
const Chat = React.lazy(() => import('./components/Chat'));
const ImageGeneration = React.lazy(() => import('./components/ImageGeneration'));
const Vision = React.lazy(() => import('./components/Vision'));
const SystemStatus = React.lazy(() => import('./components/SystemStatus'));
const ActivityViewer = React.lazy(() => import('./components/ActivityViewer'));
const Settings = React.lazy(() => import('./components/Settings'));
import ErrorBoundary from './components/ErrorBoundary';
import { FEATURES, MAIN_FEATURES } from '@/data/features';
import { Logo } from './components/Logo';
import { type Feature } from './types';
import ApiKeyNotice from '@/components/ApiKeyNotice';
import { useAuth } from './contexts/AuthContext';
import AuthPortal from './components/AuthPortal';
import { useToast } from '@/components/Toaster';

const WelcomeScreen: React.FC<{onFeatureSelect: (feature: Feature) => void}> = ({onFeatureSelect}) => {
    const features = MAIN_FEATURES.map(f => FEATURES[f]);

    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            {/* Combined coin (Y) + very slow Z rotation for layered effect */}
            <div className="coin-rotate-z-very-slow mb-6 flex-shrink-0">
                <Logo size={120} coinSpin priority />
            </div>
            <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-200">Welcome to FANTOM AI</h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 mt-2 mb-8">Your creative partner powered by Google Gemini. Select a feature to get started.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl">
                {features.map(feature => (
                    <button 
                        key={feature.id} 
                        onClick={() => onFeatureSelect(feature.id)}
                        className="p-6 bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-300 flex flex-col items-center text-center"
                    >
                                                <feature.icon className="w-10 h-10 mb-3 text-violet-500" />
                                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{feature.name}</h3>
                                                {feature.description && (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{feature.description}</p>
                                                )}
                    </button>
                ))}
            </div>
        </div>
    );
};


const App: React.FC = () => {
    const { user, signOut } = useAuth();
    const toast = useToast();
    if (!user) {
        return <AuthPortal />;
    }
    // Always start on Home (Welcome). We intentionally ignore any previously stored feature.
    const [activeFeature, setActiveFeature] = useState<Feature | null>(null);
        const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
            if (typeof window !== 'undefined') {
                return window.innerWidth >= 1024; // default open on large screens
            }
            return false;
        });

    // Clear any legacy persisted active feature so future versions don't read it.
    useEffect(() => {
        try { localStorage.removeItem('activeFeature'); } catch {}
    }, []);

    // One-time onboarding toast for the UI improvements
    useEffect(() => {
        try {
            const key = 'onboarding_toast_v1';
            const shown = localStorage.getItem(key);
            if (!shown) {
                toast.show({
                    variant: 'info',
                    title: 'New in Fantom AI',
                    message: 'Smooth page transitions and quick Copy actions are now available.',
                    duration: 4200,
                });
                localStorage.setItem(key, '1');
            }
        } catch {/* ignore */}
    }, [toast]);

    const renderActiveFeature = () => {
        switch (activeFeature) {
            case 'text':
                return <React.Suspense fallback={<LazyFallback label="Text Generation" />}>{<TextGeneration />}</React.Suspense>;
            case 'chat':
                return <React.Suspense fallback={<LazyFallback label="Chat" />}>{<Chat />}</React.Suspense>;
            case 'image':
                return <React.Suspense fallback={<LazyFallback label="Image Generation" />}>{<ImageGeneration />}</React.Suspense>;
            case 'vision':
                return <React.Suspense fallback={<LazyFallback label="Vision" />}>{<Vision />}</React.Suspense>;
            case 'status':
                return <React.Suspense fallback={<LazyFallback label="System Status" />}>{<SystemStatus />}</React.Suspense>;
            case 'activity':
                return <React.Suspense fallback={<LazyFallback label="Activity" />}>{<ActivityViewer />}</React.Suspense>;
            case 'settings':
                return <React.Suspense fallback={<LazyFallback label="Settings" />}>{<Settings />}</React.Suspense>;
            default:
                return <WelcomeScreen onFeatureSelect={(feature) => setActiveFeature(feature)} />;
        }
    };

    // Page transition helper: returns a keyed wrapper so React mounts/unmounts with animation
    const FeatureTransition: React.FC<{ feature: Feature | null; children: React.ReactNode }> = ({ feature, children }) => {
        return (
            <div
                key={feature || 'welcome'}
                className="h-full w-full will-change-transform animate-fadeSlide"
                data-feature={feature || 'welcome'}
            >
                {children}
            </div>
        );
    };

    return (
        <div className="h-screen w-screen bg-slate-100 dark:bg-[#131316] text-slate-900 dark:text-slate-100 flex overflow-hidden font-sans">
            <Sidebar 
                activeFeature={activeFeature} 
                setActiveFeature={setActiveFeature}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
            />
                <main className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-out ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}> 
                <div className="p-2 flex items-center justify-between sticky top-0 bg-slate-100/80 dark:bg-[#131316]/80 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-800">
                    <button onClick={() => setIsSidebarOpen(s => !s)} className="p-2" aria-label={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
                        {/* Always show menu (hamburger) icon for toggle */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <title>Menu</title>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <div 
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => setActiveFeature(null)}
                    >
                        <Logo size={36} className="flex-shrink-0" />
                        <span className="text-lg font-bold text-slate-800 dark:text-slate-200">FANTOM AI</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">{user.email}</span>
                        <button onClick={signOut} className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-xs hover:bg-slate-300 dark:hover:bg-slate-600">Sign out</button>
                    </div>
                </div>
                <div className="flex-grow p-2 sm:p-4 overflow-y-auto min-h-0 relative">
                    {activeFeature === 'settings' && (
                        <ApiKeyNotice onOpenSettings={() => setActiveFeature('settings')} />
                    )}
                    <ErrorBoundary context="feature">
                        <FeatureTransition feature={activeFeature}>{renderActiveFeature()}</FeatureTransition>
                    </ErrorBoundary>
                </div>
            </main>
        </div>
    );
};

const LazyFallback: React.FC<{ label?: string }> = ({ label }) => (
    <div className="h-full w-full flex items-center justify-center">
        <div className="w-full max-w-3xl p-4">
            {label && <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Loading {label}…</p>}
            <div className="animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
        </div>
    </div>
);

export default App;