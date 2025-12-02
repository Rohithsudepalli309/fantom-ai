import React, { useState } from 'react';
import { useOutlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Logo } from './Logo';
import { useAuth } from '@/contexts/AuthContext';
import { Menu, Bell } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

const Layout: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const { user, signOut } = useAuth();
    const outlet = useOutlet();

    return (
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
            {/* Sidebar */}
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            {/* Main Content */}
            <div className={cn(
                "flex-1 flex flex-col h-full transition-all duration-300 ease-in-out",
                isSidebarOpen ? "lg:ml-64" : "lg:ml-0"
            )}>
                {/* Header */}
                <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                            <Menu className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <Logo className="h-8 w-8" />
                            <span className="font-bold text-lg hidden sm:inline-block">FANTOM AI</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon">
                            <Bell className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-medium leading-none">{user?.email?.split('@')[0]}</p>
                                <p className="text-xs text-muted-foreground">{user?.email}</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={signOut}>
                                Sign out
                            </Button>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 relative">
                    {outlet as React.ReactNode}
                </main>
            </div>
        </div>
    );
};

export default Layout;
