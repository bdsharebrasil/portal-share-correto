import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isNetworkError = 
        this.state.error?.message?.includes('Failed to fetch') ||
        this.state.error?.message?.includes('Network') ||
        this.state.error?.message?.includes('CORS');

      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 rounded-lg border border-slate-700 p-8 text-center space-y-6">
            <div className="flex justify-center">
              <AlertCircle className="h-16 w-16 text-red-500" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Oops!</h1>
              <p className="text-slate-300">
                {isNetworkError 
                  ? 'Parece que há um problema de conexão. Verifique sua internet e tente novamente.'
                  : 'Desculpe, ocorreu um erro inesperado.'}
              </p>
              {import.meta.env.DEV && this.state.error && (
                <p className="text-xs text-slate-500 mt-4 font-mono break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>

            <button
              onClick={this.handleReset}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar Novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
