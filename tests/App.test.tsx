import { render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';
import { describe, it, expect, vi } from 'vitest';
import { ToastProvider } from '../src/components/Toaster';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { SettingsProvider } from '../src/contexts/SettingsContext';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// Mock child components
vi.mock('../src/components/Sidebar', () => ({ default: () => <div data-testid="sidebar">Sidebar</div> }));
vi.mock('../src/pages/Home', () => ({ default: () => <div data-testid="home">Welcome to FANTOM AI</div> }));
vi.mock('../src/pages/ChatPage', () => ({ default: () => <div>ChatPage</div> }));
// Layout needs to render Outlet for nested routes to work
vi.mock('../src/components/Layout', () => {
    const { Outlet } = require('react-router-dom');
    // require might fail in ESM? Let's use a simple mock that assumes Outlet is not needed if we mock Routes?
    // No, we are using real Routes now. So Layout MUST render Outlet.
    // But we can't easily import Outlet inside vi.mock factory if it's hoisted.
    // We can just mock Layout to render children? No, Layout uses Outlet.
    // Let's mock Layout to just be a div that renders props.children? 
    // Route element={<Layout />} doesn't pass children to Layout. It expects Layout to use Outlet.
    // So we need a Layout mock that renders Outlet.
    return { default: () => <div>Layout <Outlet /></div> };
});
// Wait, I can't use require or import inside vi.mock easily for external libs if I want to avoid issues.
// Let's try to use a simple mock for Layout and see if we can get away with it.
// Actually, if I use real react-router-dom, I can just import Outlet in the test file and use it in the mock?
// No, vi.mock is hoisted.
// I will use a functional component that returns an Outlet-like structure or just mock Layout to return null and see if Home renders? No, Home is nested.
// If Layout doesn't render Outlet, Home won't render.
// Solution: Mock Layout to return <div data-testid="layout"><div id="outlet-placeholder" /></div> and we might need to mock Outlet too?
// Actually, let's just NOT mock Layout and let it render? Layout might have dependencies.
// Layout.tsx imports Sidebar, Header, etc.
// Let's mock Layout to use a fake Outlet.
// Or better: Mock `react-router-dom`'s `Outlet`? No, we want real routing.
// Let's use `vi.importActual` for `react-router-dom` in the test, but override `BrowserRouter`.

// Mock AuthPortal
vi.mock('../src/components/AuthPortal', () => ({ default: () => <div data-testid="auth-portal">AuthPortal</div> }));

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

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        // Mock BrowserRouter to be a pass-through so we can wrap App in MemoryRouter
        BrowserRouter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    };
});

// Mock Layout to render Outlet
vi.mock('../src/components/Layout', async () => {
    // We need Outlet. But we can't import it here.
    // However, since we are using real react-router-dom (mostly), 
    // maybe we can just return a component that renders children?
    // No, Route element={<Layout />} doesn't receive children.

    // Let's try to import Outlet from the mocked react-router-dom?
    // const { Outlet } = await vi.importActual('react-router-dom');
    // return { default: () => <div>Layout <Outlet /></div> };
    // This works in async mock factory!
    const { Outlet } = await vi.importActual('react-router-dom');
    return { default: () => <div>Layout <div data-testid="outlet" /></div> };
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
            <MemoryRouter initialEntries={['/']}>
                <AuthProvider>
                    <SettingsProvider>
                        <ThemeProvider>
                            <ToastProvider>
                                <App />
                            </ToastProvider>
                        </ThemeProvider>
                    </SettingsProvider>
                </AuthProvider>
            </MemoryRouter>
        );

        screen.debug();

        await waitFor(() => {
            expect(screen.getByTestId('home')).toBeInTheDocument();
        });
    });
});
