import { render, screen } from '@testing-library/react';
import App from '../src/App';
import { describe, it, expect, vi } from 'vitest';
import { ToastProvider } from '../src/components/Toaster';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { SettingsProvider } from '../src/contexts/SettingsContext';
import React from 'react';

// Mock child components
vi.mock('../src/components/Sidebar', () => ({ default: () => <div data-testid="sidebar">Sidebar</div> }));
vi.mock('../src/pages/Home', () => ({ default: () => <div data-testid="home">Welcome to FANTOM AI</div> }));
vi.mock('../src/pages/ChatPage', () => ({ default: () => <div>ChatPage</div> }));
vi.mock('../src/components/Layout', () => {
    const { Outlet } = require('react-router-dom');
    return { default: () => <div>Layout <Outlet /></div> };
});

// Mock useAuth
vi.mock('../src/contexts/AuthContext', async () => {
    const actual = await vi.importActual('../src/contexts/AuthContext');
    return {
        ...actual,
        useAuth: () => ({
            user: { uid: 'test-uid', email: 'test@example.com' },
            signOut: vi.fn(),
        }),
        AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    };
});

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();
// Mock ResizeObserver
window.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

describe('App', () => {
    it('renders without crashing', async () => {
        render(
            <AuthProvider>
                <SettingsProvider>
                    <ThemeProvider>
                        <ToastProvider>
                            <App />
                        </ToastProvider>
                    </ThemeProvider>
                </SettingsProvider>
            </AuthProvider>
        );

        // App should render Home page at root /
        // Wait, App renders Routes. MemoryRouter initialEntries defaults to ['/']
        // So it should render Home.
        // But App uses useLocation.

        screen.debug();
        // Check for Home content
        expect(await screen.findByText(/Welcome to FANTOM AI/i)).toBeInTheDocument();
    });
});
