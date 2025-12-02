import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { MAIN_FEATURES, FEATURES } from '@/data/features';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { isNemotronConfigured } from '@/services/nemotronService';
import { isGrokConfigured } from '@/services/grokService';
import { useAuth } from '@/contexts/AuthContext';
import { getStorageProvider } from '@/services/storageService';
import { ActivityRecord } from '@/types';
import {
    CheckIcon, ErrorIcon, SparklesIcon, HistoryIcon,
    ToolsIcon, ChatIcon, ImageIcon, VisionIcon, TextIcon
} from '@/components/Icons';

// Quick action buttons for common tasks
const QuickAction: React.FC<{
    icon: React.FC<{ className?: string }>;
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
}> = ({ icon: Icon, label, onClick, variant = 'secondary' }) => (
    <button
        onClick={onClick}
        className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
            variant === 'primary'
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
        )}
    >
        <Icon className="w-4 h-4" />
        {label}
    </button>
);

// Status indicator component
const StatusIndicator: React.FC<{ configured: boolean; label: string }> = ({ configured, label }) => (
    <div className="flex items-center gap-2">
        <div className={cn(
            "w-2 h-2 rounded-full",
            configured ? "bg-green-500" : "bg-amber-500"
        )} />
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn(
            "text-xs font-medium",
            configured ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
        )}>
            {configured ? "Ready" : "Not Configured"}
        </span>
    </div>
);

// Getting started tip component
const GettingStartedTip: React.FC<{
    icon: React.FC<{ className?: string }>;
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
}> = ({ icon: Icon, title, description, action }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
        <div className="p-2 rounded-md bg-primary/10">
            <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-foreground">{title}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            {action && (
                <button
                    onClick={action.onClick}
                    className="text-xs text-primary hover:underline mt-1"
                >
                    {action.label} →
                </button>
            )}
        </div>
    </div>
);

const Home: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const features = MAIN_FEATURES.map(f => FEATURES[f]);

    // API status
    const nvidiaConfigured = isNemotronConfigured();
    const grokConfigured = isGrokConfigured();

    // Activity stats
    const [recentActivity, setRecentActivity] = useState<ActivityRecord[]>([]);
    const [activityStats, setActivityStats] = useState({
        chatMessages: 0,
        imagesGenerated: 0,
        visionQueries: 0,
        textGenerations: 0
    });

    useEffect(() => {
        const loadActivity = async () => {
            if (!user?.uid) return;
            try {
                const provider = await getStorageProvider();
                const activities = await provider.listActivities(user.uid, 50);
                setRecentActivity(activities);

                // Calculate stats from recent activity
                const stats = {
                    chatMessages: activities.filter(a => a.type === 'chat.message').length,
                    imagesGenerated: activities.filter(a => a.type === 'image.generate').length,
                    visionQueries: activities.filter(a => a.type === 'vision.query').length,
                    textGenerations: 0 // Not tracked in current activity types
                };
                setActivityStats(stats);
            } catch (e) {
                console.warn('Failed to load activity stats:', e);
            }
        };
        loadActivity();
    }, [user]);

    // Check if user needs onboarding (no API keys configured)
    const needsSetup = !nvidiaConfigured;
    const hasActivity = recentActivity.length > 0;

    return (
        <div className="flex flex-col items-center text-center p-4 animate-fadeSlide">
            {/* Hero Section */}
            <div className="coin-rotate-z-very-slow mb-6 flex-shrink-0">
                <Logo size={100} coinSpin priority />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Welcome to FANTOM AI</h1>
            <p className="text-base text-muted-foreground mb-6 max-w-xl">
                Your creative partner powered by NVIDIA Nemotron Nano 12B 2 VL.
            </p>

            {/* API Status Section */}
            <Card className="w-full max-w-4xl mb-6 border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <SparklesIcon className="w-5 h-5 text-primary" />
                            <span className="text-sm font-medium">API Status</span>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            <StatusIndicator configured={nvidiaConfigured} label="NVIDIA" />
                            <StatusIndicator configured={grokConfigured} label="Grok" />
                        </div>
                        {needsSetup && (
                            <button
                                onClick={() => navigate('/settings')}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                                <ToolsIcon className="w-3 h-3" />
                                Configure API Keys
                            </button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Quick Stats Section (only shown if user has activity) */}
            {hasActivity && (
                <Card className="w-full max-w-4xl mb-6 border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <HistoryIcon className="w-5 h-5 text-primary" />
                            <span className="text-sm font-medium">Recent Activity</span>
                            <button
                                onClick={() => navigate('/activity')}
                                className="ml-auto text-xs text-primary hover:underline"
                            >
                                View All →
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-3 rounded-lg bg-muted/50">
                                <ChatIcon className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                                <div className="text-xl font-bold">{activityStats.chatMessages}</div>
                                <div className="text-xs text-muted-foreground">Chat Messages</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-muted/50">
                                <ImageIcon className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                                <div className="text-xl font-bold">{activityStats.imagesGenerated}</div>
                                <div className="text-xs text-muted-foreground">Images Created</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-muted/50">
                                <VisionIcon className="w-5 h-5 mx-auto mb-1 text-green-500" />
                                <div className="text-xl font-bold">{activityStats.visionQueries}</div>
                                <div className="text-xs text-muted-foreground">Vision Queries</div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-muted/50">
                                <TextIcon className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                                <div className="text-xl font-bold">{activityStats.textGenerations}</div>
                                <div className="text-xs text-muted-foreground">Text Generated</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
                <QuickAction
                    icon={ChatIcon}
                    label="Start Chat"
                    onClick={() => navigate('/chat')}
                    variant="primary"
                />
                <QuickAction
                    icon={ImageIcon}
                    label="Create Image"
                    onClick={() => navigate('/image')}
                />
                <QuickAction
                    icon={TextIcon}
                    label="Generate Text"
                    onClick={() => navigate('/text')}
                />
                <QuickAction
                    icon={VisionIcon}
                    label="Analyze Image"
                    onClick={() => navigate('/vision')}
                />
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-5xl mb-8">
                {features.map(feature => (
                    <Card
                        key={feature.id}
                        onClick={() => navigate(`/${feature.id}`)}
                        className="cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm group"
                    >
                        <CardContent className="flex flex-col items-center p-6">
                            <feature.icon className="w-12 h-12 mb-4 text-primary group-hover:text-primary/80 transition-colors" />
                            <h3 className="text-xl font-semibold mb-2">{feature.name}</h3>
                            <span className="inline-block mb-2 px-2 py-0.5 text-[10px] font-semibold rounded bg-primary/10 text-primary uppercase tracking-wide">
                                Nemotron
                            </span>
                            {feature.description && (
                                <p className="text-sm text-muted-foreground">{feature.description}</p>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Getting Started Tips (shown if setup is needed) */}
            {needsSetup && (
                <Card className="w-full max-w-4xl border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <SparklesIcon className="w-5 h-5 text-primary" />
                            <span className="text-sm font-medium">Getting Started</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <GettingStartedTip
                                icon={ToolsIcon}
                                title="Set up your API key"
                                description="Configure your NVIDIA API key to unlock all AI features."
                                action={{
                                    label: "Go to Settings",
                                    onClick: () => navigate('/settings')
                                }}
                            />
                            <GettingStartedTip
                                icon={ChatIcon}
                                title="Try the AI Chat"
                                description="Have a conversation with Nemotron for questions and creative tasks."
                                action={{
                                    label: "Open Chat",
                                    onClick: () => navigate('/chat')
                                }}
                            />
                            <GettingStartedTip
                                icon={ImageIcon}
                                title="Generate Images"
                                description="Create stunning visuals from text descriptions with AI."
                                action={{
                                    label: "Create Image",
                                    onClick: () => navigate('/image')
                                }}
                            />
                            <GettingStartedTip
                                icon={VisionIcon}
                                title="Analyze Images"
                                description="Upload images and ask questions to get detailed insights."
                                action={{
                                    label: "Try Vision",
                                    onClick: () => navigate('/vision')
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default Home;
