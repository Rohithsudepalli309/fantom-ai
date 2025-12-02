import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  context: 'app' | 'feature';
}

interface State {
  hasError: boolean;
}

// Self-contained error icon to prevent dependency issues.
// Avoid relying on React DOM-specific SVG types due to minimal react.d.ts in this repo.
const SelfContainedErrorIcon: React.FC<{ className?: string; [key: string]: any }> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);


class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error(`Uncaught error in ${this.props.context} context:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isAppContext = this.props.context === 'app';
      const message = isAppContext
        ? "The application has encountered a critical error. Please refresh the page to continue."
        : "An unexpected error occurred in this feature. Please try selecting a different one from the sidebar or refresh the page.";
        
      const ctaText = isAppContext ? "Refresh Page" : "Refresh Page";
      const ctaAction = () => window.location.reload();


      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400 p-4 bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg">
          <SelfContainedErrorIcon className="w-16 h-16 mb-6 text-red-500" />
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-4">Oops! Something went wrong.</h1>
          <p className="max-w-md text-base text-slate-600 dark:text-slate-300 mb-6">
            {message}
          </p>
          <button
            onClick={ctaAction}
            className="px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-opacity-50 transition-colors text-sm font-semibold"
          >
            {ctaText}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;