import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { MAIN_FEATURES, FEATURES } from '@/data/features';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const Home: React.FC = () => {
    const navigate = useNavigate();
    const features = MAIN_FEATURES.map(f => FEATURES[f]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-4 animate-fadeSlide">
            <div className="coin-rotate-z-very-slow mb-8 flex-shrink-0">
                <Logo size={120} coinSpin priority />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Welcome to FANTOM AI</h1>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl">
                Select a feature to get started.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-5xl">
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
        </div>
    );
};

export default Home;
