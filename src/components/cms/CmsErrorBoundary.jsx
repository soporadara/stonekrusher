import React from 'react';

/**
 * Dedicated CMS Error Boundary.
 * Protects the CMS application from white screen of death.
 * Provides easy recovery buttons to reload, clear corrupt session data,
 * or return to the main website safely.
 */
export default class CmsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CMS Error caught by CmsErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetCms = () => {
    try {
      localStorage.removeItem('cms_user');
      localStorage.removeItem('cms_theme');
      sessionStorage.clear();
    } catch {}
    window.location.href = '/ourcmskiuq/';
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
            maxWidth: '560px',
            width: '100%',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '36px 30px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              margin: '0 auto 16px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              ⚡
            </div>

            <h1 style={{
              margin: '0 0 8px',
              fontSize: '22px',
              fontWeight: '800',
              color: '#ffffff'
            }}>
              CMS Console Recovery
            </h1>

            <p style={{
              margin: '0 0 20px',
              fontSize: '14px',
              color: '#94a3b8',
              lineHeight: 1.55
            }}>
              The CMS encountered an issue loading administrative modules. You can refresh the console or reset your session cache below.
            </p>

            {this.state.error && (
              <div style={{
                textAlign: 'left',
                background: '#090d16',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '22px',
                fontSize: '12px',
                color: '#fca5a5',
                fontFamily: 'monospace',
                overflowX: 'auto',
                maxHeight: '100px'
              }}>
                <strong>Error:</strong> {this.state.error?.message || String(this.state.error)}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '10px 20px',
                  borderRadius: '9999px',
                  background: '#607a4e',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '13.5px',
                  cursor: 'pointer'
                }}
              >
                ↻ Refresh CMS
              </button>

              <button
                type="button"
                onClick={this.handleResetCms}
                style={{
                  padding: '10px 20px',
                  borderRadius: '9999px',
                  background: '#334155',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  fontWeight: '600',
                  fontSize: '13.5px',
                  cursor: 'pointer'
                }}
              >
                Clear Cache & Re-Login
              </button>

              <button
                type="button"
                onClick={this.props.onBackToSite || (() => { window.location.href = '/'; })}
                style={{
                  padding: '10px 20px',
                  borderRadius: '9999px',
                  background: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  fontWeight: '600',
                  fontSize: '13.5px',
                  cursor: 'pointer'
                }}
              >
                ← Back to Public Site
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
