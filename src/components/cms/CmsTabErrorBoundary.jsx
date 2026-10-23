import React from 'react';

/**
 * Tab-level Error Boundary for CMS.
 * Isolates runtime errors to the active tab so that a crash in one view
 * (e.g. malformed blog post data) does not take down the entire CMS console.
 */
export default class CmsTabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`Error in CMS Tab [${this.props.tabName || 'Unknown'}]:`, error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    // Automatically reset error boundary if user switches tabs
    if (prevProps.tabKey !== this.props.tabKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="cms-card" style={{
          padding: '48px 32px',
          textAlign: 'center',
          maxWidth: '680px',
          margin: '32px auto',
          background: 'var(--cms-card-bg, #1e293b)',
          border: '1px solid var(--cms-border, #334155)',
          borderRadius: '16px'
        }}>
          <div style={{
            fontSize: '2.5rem',
            marginBottom: '12px'
          }}>
            ⚠️
          </div>

          <h2 style={{
            margin: '0 0 8px',
            fontSize: '1.25rem',
            fontWeight: '700',
            color: 'var(--cms-text, #f8fafc)'
          }}>
            {this.props.tabName || 'Module'} Encountered an Error
          </h2>

          <p style={{
            margin: '0 0 20px',
            fontSize: '0.9rem',
            color: 'var(--cms-text-muted, #94a3b8)',
            lineHeight: 1.6
          }}>
            This section experienced a problem while rendering. You can retry loading it, or switch to another section from the sidebar.
          </p>

          {this.state.error && (
            <div style={{
              textAlign: 'left',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--cms-border, #334155)',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '24px',
              fontSize: '12px',
              color: '#fca5a5',
              fontFamily: 'monospace',
              overflowX: 'auto',
              maxHeight: '100px'
            }}>
              <strong>Details:</strong> {this.state.error?.message || String(this.state.error)}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="cms-btn cms-btn-primary"
              onClick={this.handleRetry}
            >
              ↻ Retry {this.props.tabName || 'Module'}
            </button>

            {this.props.onReset && (
              <button
                type="button"
                className="cms-btn cms-btn-secondary"
                onClick={this.props.onReset}
              >
                Return to Dashboard
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
