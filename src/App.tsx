import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './contexts/AuthContext';
import AuthPortal from './components/AuthPortal';
import { useToast } from '@/components/Toaster';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import ChatPage from '@/pages/ChatPage';
import ErrorBoundary from './components/ErrorBoundary';
import PageTransition from '@/components/PageTransition';

// Lazy load other components
const TextGeneration = React.lazy(() => import('./components/TextGeneration'));
const ImageGeneration = React.lazy(() => import('./components/ImageGeneration'));
const Vision = React.lazy(() => import('./components/Vision'));
const SystemStatus = React.lazy(() => import('./components/SystemStatus'));
const ActivityViewer = React.lazy(() => import('./components/ActivityViewer'));
const Settings = React.lazy(() => import('./components/Settings'));

const AnimatedRoutes: React.FC = () => {
    const location = useLocation();
    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Layout />}>
                    <Route index element={<PageTransition><Home /></PageTransition>} />
                    <Route path="chat" element={
                        <PageTransition>
                            <React.Suspense fallback={<LazyFallback label="Chat" />}>
                                <ChatPage />
                            </React.Suspense>
                        </PageTransition>
                    } />
                    <Route path="text" element={
                        <PageTransition>
                            <React.Suspense fallback={<LazyFallback label="Text Generation" />}>
                                <TextGeneration />
                            </React.Suspense>
                        </PageTransition>
                    } />
                    <Route path="image" element={
                        <PageTransition>
                            <React.Suspense fallback={<LazyFallback label="Image Generation" />}>
                                <ImageGeneration />
                            </React.Suspense>
                        </PageTransition>
                    } />
                    <Route path="vision" element={
                        <PageTransition>
                            <React.Suspense fallback={<LazyFallback label="Vision" />}>
                                <Vision />
                            </React.Suspense>
                        </PageTransition>
                    } />
                    <Route path="status" element={
                        <PageTransition>
                            <React.Suspense fallback={<LazyFallback label="System Status" />}>
                                <SystemStatus />
                            </React.Suspense>
                        </PageTransition>
                    } />
                    <Route path="activity" element={
                        <PageTransition>
                            <React.Suspense fallback={<LazyFallback label="Activity" />}>
                                <ActivityViewer />
                            </React.Suspense>
                        </PageTransition>
                    } />
                    <Route path="settings" element={
                        <PageTransition>
                            <React.Suspense fallback={<LazyFallback label="Settings" />}>
                                <Settings />
                            </React.Suspense>
                        </PageTransition>
                    } />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </AnimatePresence>
    );
};

const App: React.FC = () => {
    const { user } = useAuth();
    const toast = useToast();

    // One-time onboarding toast
    React.useEffect(() => {
        try {
            const key = 'onboarding_toast_v2';
            const shown = localStorage.getItem(key);
            if (!shown && user) {
                toast.show({
                    variant: 'info',
                    title: 'Welcome to the new Fantom AI',
                    message: 'Experience the new premium design and enhanced navigation.',
                    duration: 4200,
                });
                localStorage.setItem(key, '1');
            }
        } catch {/* ignore */ }
    }, [toast, user]);

    if (!user) {
        return <AuthPortal />;
    }

    return (
        <BrowserRouter>
            <ErrorBoundary context="app">
                <AnimatedRoutes />
            </ErrorBoundary>
        </BrowserRouter>
    );
};

const LazyFallback: React.FC<{ label?: string }> = ({ label }) => (
    <div className="h-full w-full flex items-center justify-center">
        <div className="w-full max-w-3xl p-4">
            {label && <p className="mb-3 text-sm text-muted-foreground">Loading {label}…</p>}
            <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-48 bg-muted rounded" />
            </div>
        </div>
    </div>
);

export default App;