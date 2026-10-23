import React from 'react';

/**
 * Global Error Boundary to prevent React White Screen of Death (WSoD).
 * Catches unhandled runtime errors anywhere in the component tree and
 * presents a clean, branded recovery UI with options to retry or reset storage.
 */
export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error caught by GlobalErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetStorage = () => {
    try {
      // Clear potentially corrupt cached application and CMS state
      const keysToClear = [
        'konstructzBlogPosts',
        'konstructzBlogPostsUpdatedAt',
        'konstructzUserHasManagedBlogPosts',
        'konstructzProductViews',
        'konstructzBlogPostViews',
        'cms_theme'
      ];
      keysToClear.forEach(k => localStorage.removeItem(k));
    } catch {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#f8fafc',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            maxWidth: '620px',
            width: '100%',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '36px 32px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 18px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px'
            }}>
              ⚠️
            </div>

            <h1 style={{
              margin: '0 0 8px',
              fontSize: '22px',
              fontWeight: '800',
              color: '#ffffff'
            }}>
              Application Recovery Mode
            </h1>

            <p style={{
              margin: '0 0 24px',
              fontSize: '14px',
              color: '#94a3b8',
              lineHeight: 1.6
            }}>
              A component encountered an unexpected error while loading. Your data is safe. You can reload the page or return to the website.
            </p>

            {this.state.error && (
              <div style={{
                textAlign: 'left',
                background: '#090d16',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '24px',
                fontSize: '12px',
                color: '#fca5a5',
                fontFamily: 'monospace',
                overflowX: 'auto',
                maxHeight: '120px'
              }}>
                <strong>Error:</strong> {this.state.error?.message || String(this.state.error)}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '10px 22px',
                  borderRadius: '9999px',
                  background: '#607a4e',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                ↻ Reload Page
              </button>

              <button
                type="button"
                onClick={this.handleResetStorage}
                style={{
                  padding: '10px 22px',
                  borderRadius: '9999px',
                  background: '#334155',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Clear Cache & Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
