import React from 'react';
import { reportError } from '../services/utils/crashReporter';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, {
      component: 'ErrorBoundary',
      action: 'componentDidCatch',
      extra: { componentStack: info.componentStack },
    });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleDismiss = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Be Vietnam Pro, sans-serif',
          background: 'linear-gradient(180deg, #f5fbf8 0%, #eef4ff 48%, #f8fafc 100%)',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            width: '100%',
            background: '#fff',
            borderRadius: '24px',
            border: '1px solid #e2e8f0',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '0 24px 80px rgba(15,23,42,0.10)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 16px',
              borderRadius: '16px',
              background: 'rgba(239,68,68,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
            }}
          >
            ⚠
          </div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0 0 8px',
            }}
          >
            Đã xảy ra lỗi không mong muốn
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: '#64748b',
              lineHeight: '1.6',
              margin: '0 0 8px',
            }}
          >
            Ứng dụng gặp sự cố. Dữ liệu đã lưu trước đó vẫn an toàn.
          </p>
          {this.state.error?.message && (
            <pre
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                background: '#f8fafc',
                borderRadius: '12px',
                padding: '12px',
                margin: '0 0 20px',
                overflow: 'auto',
                maxHeight: '120px',
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={this.handleDismiss}
              style={{
                height: '44px',
                padding: '0 20px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: '#334155',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Thử tiếp tục
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                height: '44px',
                padding: '0 20px',
                borderRadius: '12px',
                border: 'none',
                background: '#0d7c66',
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Tải lại ứng dụng
            </button>
          </div>
        </div>
      </div>
    );
  }
}
