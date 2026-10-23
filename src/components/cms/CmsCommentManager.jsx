import React, { useState, useEffect } from 'react';

export default function CmsCommentManager({ csrfToken }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [operatingId, setOperatingId] = useState(null);

  const fetchComments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/comments.php');
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.comments)) {
        setComments(data.comments);
      } else {
        setComments([]);
      }
    } catch (err) {
      setError('Failed to fetch comments: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, []);

  const handleUpdateStatus = async (commentId, newStatus) => {
    try {
      setOperatingId(commentId);
      setActionNotice('');
      setActionError('');

      const res = await fetch('/api/comments.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          action: 'update_status',
          id: commentId,
          status: newStatus,
          csrf_token: csrfToken
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionNotice(`Comment marked as ${newStatus}.`);
        setComments(prev => prev.map(c => (c.id === commentId || c.commentId === commentId) ? { ...c, status: newStatus, moderationStatus: newStatus } : c));
      } else {
        setActionError(data.error || 'Failed to update status');
      }
      setTimeout(() => { setActionNotice(''); setActionError(''); }, 4000);
    } catch (err) {
      setActionError('Error updating comment: ' + err.message);
      setTimeout(() => setActionError(''), 4000);
    } finally {
      setOperatingId(null);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Are you sure you want to permanently delete this comment?')) return;
    try {
      setOperatingId(commentId);
      setActionNotice('');
      setActionError('');

      const res = await fetch('/api/comments.php', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          action: 'delete',
          id: commentId,
          csrf_token: csrfToken
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionNotice('Comment permanently deleted.');
        setComments(prev => prev.filter(c => c.id !== commentId && c.commentId !== commentId));
      } else {
        setActionError(data.error || 'Failed to delete comment');
      }
      setTimeout(() => { setActionNotice(''); setActionError(''); }, 4000);
    } catch (err) {
      setActionError('Error deleting comment: ' + err.message);
      setTimeout(() => setActionError(''), 4000);
    } finally {
      setOperatingId(null);
    }
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    setActionNotice('Comment text copied to clipboard!');
    setTimeout(() => setActionNotice(''), 3000);
  };

  // Metrics
  const totalCount = comments.length;
  const approvedCount = comments.filter(c => (c.status || '').toLowerCase() === 'approved').length;
  const pendingCount = comments.filter(c => (c.status || '').toLowerCase() === 'pending').length;
  const spamCount = comments.filter(c => (c.status || '').toLowerCase() === 'spam').length;

  // Filtered comments
  const filteredComments = comments.filter(c => {
    const statusMatch = filterStatus === 'all' || (c.status || 'approved').toLowerCase() === filterStatus.toLowerCase();
    if (!statusMatch) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.authorName || c.displayName || '').toLowerCase().includes(q) ||
      (c.content || c.text || '').toLowerCase().includes(q) ||
      (c.blogSlug || c.postId || '').toLowerCase().includes(q) ||
      (c.authorEmail || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Banner / Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--cms-text)' }}>
            Customer Comments & Reviews
          </h1>
          <p style={{ margin: 0, color: 'var(--cms-text-muted)', fontSize: '0.92rem' }}>
            Moderate community discussions, approve verified feedback, and filter spam.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchComments}
            className="cms-btn cms-btn-secondary cms-btn-sm"
            style={{ borderRadius: '9999px', padding: '8px 18px' }}
          >
            🔄 Refresh List
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionNotice && (
        <div style={{
          padding: '12px 18px',
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid #10b981',
          color: '#10b981',
          borderRadius: '12px',
          fontSize: '0.88rem',
          fontWeight: 600
        }}>
          ✔ {actionNotice}
        </div>
      )}
      {actionError && (
        <div style={{
          padding: '12px 18px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid #ef4444',
          color: '#ef4444',
          borderRadius: '12px',
          fontSize: '0.88rem',
          fontWeight: 600
        }}>
          ⚠️ {actionError}
        </div>
      )}

      {/* 4 Donezo-Styled Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        
        {/* Total Comments - Dark Green Pill Card */}
        <div
          onClick={() => setFilterStatus('all')}
          style={{
            background: filterStatus === 'all' ? 'var(--cms-primary, #0f4c3a)' : 'var(--cms-card-bg)',
            color: filterStatus === 'all' ? '#ffffff' : 'var(--cms-text)',
            borderRadius: '20px',
            padding: '22px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            border: `1px solid ${filterStatus === 'all' ? 'transparent' : 'var(--cms-card-border)'}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 600, opacity: 0.85 }}>Total Comments</span>
            <span style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: filterStatus === 'all' ? 'rgba(255,255,255,0.2)' : 'var(--cms-bg-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem'
            }}>💬</span>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, lineHeight: 1 }}>{totalCount}</div>
          <div style={{ fontSize: '0.78rem', marginTop: '10px', opacity: 0.8 }}>All recorded reader remarks</div>
        </div>

        {/* Approved Comments */}
        <div
          onClick={() => setFilterStatus('approved')}
          style={{
            background: filterStatus === 'approved' ? 'var(--cms-primary, #0f4c3a)' : 'var(--cms-card-bg)',
            color: filterStatus === 'approved' ? '#ffffff' : 'var(--cms-text)',
            borderRadius: '20px',
            padding: '22px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            border: `1px solid ${filterStatus === 'approved' ? 'transparent' : 'var(--cms-card-border)'}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 600, opacity: 0.85 }}>Approved</span>
            <span style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: filterStatus === 'approved' ? 'rgba(255,255,255,0.2)' : 'rgba(16, 185, 129, 0.15)',
              color: filterStatus === 'approved' ? '#fff' : '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem'
            }}>✔</span>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, lineHeight: 1 }}>{approvedCount}</div>
          <div style={{ fontSize: '0.78rem', marginTop: '10px', opacity: 0.8 }}>Live on public blog</div>
        </div>

        {/* Pending Moderation */}
        <div
          onClick={() => setFilterStatus('pending')}
          style={{
            background: filterStatus === 'pending' ? 'var(--cms-primary, #0f4c3a)' : 'var(--cms-card-bg)',
            color: filterStatus === 'pending' ? '#ffffff' : 'var(--cms-text)',
            borderRadius: '20px',
            padding: '22px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            border: `1px solid ${filterStatus === 'pending' ? 'transparent' : 'var(--cms-card-border)'}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 600, opacity: 0.85 }}>Pending Moderation</span>
            <span style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: filterStatus === 'pending' ? 'rgba(255,255,255,0.2)' : 'rgba(245, 158, 11, 0.15)',
              color: filterStatus === 'pending' ? '#fff' : '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem'
            }}>⏳</span>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, lineHeight: 1 }}>{pendingCount}</div>
          <div style={{ fontSize: '0.78rem', marginTop: '10px', opacity: 0.8 }}>Requires verification</div>
        </div>

        {/* Flagged as Spam */}
        <div
          onClick={() => setFilterStatus('spam')}
          style={{
            background: filterStatus === 'spam' ? 'var(--cms-primary, #0f4c3a)' : 'var(--cms-card-bg)',
            color: filterStatus === 'spam' ? '#ffffff' : 'var(--cms-text)',
            borderRadius: '20px',
            padding: '22px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            border: `1px solid ${filterStatus === 'spam' ? 'transparent' : 'var(--cms-card-border)'}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 600, opacity: 0.85 }}>Spam / Blocked</span>
            <span style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: filterStatus === 'spam' ? 'rgba(255,255,255,0.2)' : 'rgba(239, 68, 68, 0.15)',
              color: filterStatus === 'spam' ? '#fff' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem'
            }}>🚫</span>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, lineHeight: 1 }}>{spamCount}</div>
          <div style={{ fontSize: '0.78rem', marginTop: '10px', opacity: 0.8 }}>Disapproved entries</div>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: 'var(--cms-card-bg)',
        borderRadius: '20px',
        padding: '16px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        border: '1px solid var(--cms-card-border)'
      }}>
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Comments', count: totalCount },
            { id: 'approved', label: 'Approved', count: approvedCount },
            { id: 'pending', label: 'Pending', count: pendingCount },
            { id: 'spam', label: 'Spam', count: spamCount }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              style={{
                borderRadius: '9999px',
                padding: '7px 16px',
                fontSize: '0.84rem',
                fontWeight: 600,
                border: filterStatus === f.id ? 'none' : '1px solid var(--cms-card-border)',
                background: filterStatus === f.id ? 'var(--cms-primary, #0f4c3a)' : 'transparent',
                color: filterStatus === f.id ? '#ffffff' : 'var(--cms-text)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{f.label}</span>
              <span style={{
                fontSize: '0.74rem',
                padding: '1px 6px',
                borderRadius: '999px',
                background: filterStatus === f.id ? 'rgba(255,255,255,0.25)' : 'var(--cms-bg-muted)',
                color: filterStatus === f.id ? '#ffffff' : 'var(--cms-text-muted)'
              }}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{
          position: 'relative',
          minWidth: '260px',
          flex: 1,
          maxWidth: '380px'
        }}>
          <input
            type="text"
            placeholder="Search author, comment, article..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 16px 9px 36px',
              borderRadius: '9999px',
              border: '1px solid var(--cms-card-border)',
              background: 'var(--cms-bg-muted)',
              color: 'var(--cms-text)',
              fontSize: '0.86rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '0.9rem' }}>
            🔍
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                opacity: 0.5,
                color: 'inherit'
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Comments List */}
      <div style={{
        background: 'var(--cms-card-bg)',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid var(--cms-card-border)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
      }}>
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>
            <div style={{ fontSize: '2rem', animation: 'spin 1.2s linear infinite', marginBottom: '10px' }}>⚡</div>
            <span>Loading customer comments...</span>
          </div>
        )}

        {!loading && filteredComments.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💬</div>
            <h3 style={{ margin: '0 0 6px', color: 'var(--cms-text)' }}>No Comments Found</h3>
            <p style={{ margin: 0, fontSize: '0.88rem' }}>
              {searchQuery ? `No comments match "${searchQuery}".` : 'No comments currently in this category.'}
            </p>
          </div>
        )}

        {!loading && filteredComments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredComments.map(comment => {
              const cId = comment.id || comment.commentId;
              const author = comment.authorName || comment.displayName || 'Anonymous Reader';
              const email = comment.publicEmail || comment.authorEmail;
              const status = (comment.status || comment.moderationStatus || 'Approved');
              const isApproved = status.toLowerCase() === 'approved';
              const isSpam = status.toLowerCase() === 'spam';
              const isPending = status.toLowerCase() === 'pending';

              return (
                <div
                  key={cId}
                  style={{
                    padding: '20px',
                    borderRadius: '16px',
                    background: 'var(--cms-bg-muted)',
                    border: '1px solid var(--cms-card-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Top row: Author & Meta */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Avatar */}
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--cms-primary, #0f4c3a), #15803d)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1.05rem',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}>
                        {comment.photoURL || comment.avatar ? (
                          <img src={comment.photoURL || comment.avatar} alt={author} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          author[0].toUpperCase()
                        )}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--cms-text)' }}>{author}</span>
                          {comment.emailVerified && (
                            <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 600 }}>
                              Verified
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--cms-text-muted)', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                          {email && <span>📧 {email}</span>}
                          <span>📅 {comment.date || comment.createdAt || 'Recent'}</span>
                          {comment.blogSlug && (
                            <a
                              href={`/blog/${comment.blogSlug}/`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--cms-primary)', textDecoration: 'none', fontWeight: 600 }}
                            >
                              📖 /{comment.blogSlug}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Chip */}
                    <div>
                      <span style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '4px 12px',
                        borderRadius: '999px',
                        background: isApproved ? 'rgba(16, 185, 129, 0.15)' : isPending ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: isApproved ? '#10b981' : isPending ? '#f59e0b' : '#ef4444',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        {isApproved && '✔ Approved'}
                        {isPending && '⏳ Pending Moderation'}
                        {isSpam && '🚫 Spam'}
                      </span>
                    </div>
                  </div>

                  {/* Comment Body */}
                  <div style={{
                    padding: '14px 18px',
                    borderRadius: '12px',
                    background: 'var(--cms-card-bg)',
                    border: '1px solid var(--cms-card-border)',
                    fontSize: '0.92rem',
                    lineHeight: 1.55,
                    color: 'var(--cms-text)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {comment.content || comment.text}
                  </div>

                  {/* Action Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {!isApproved && (
                        <button
                          disabled={operatingId === cId}
                          onClick={() => handleUpdateStatus(cId, 'Approved')}
                          style={{
                            borderRadius: '9999px',
                            padding: '6px 14px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          ✔ Approve
                        </button>
                      )}
                      {!isPending && (
                        <button
                          disabled={operatingId === cId}
                          onClick={() => handleUpdateStatus(cId, 'Pending')}
                          style={{
                            borderRadius: '9999px',
                            padding: '6px 14px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background: 'var(--cms-card-bg)',
                            color: '#f59e0b',
                            border: '1px solid #f59e0b',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          ⏳ Mark Pending
                        </button>
                      )}
                      {!isSpam && (
                        <button
                          disabled={operatingId === cId}
                          onClick={() => handleUpdateStatus(cId, 'Spam')}
                          style={{
                            borderRadius: '9999px',
                            padding: '6px 14px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background: 'var(--cms-card-bg)',
                            color: '#ef4444',
                            border: '1px solid #ef4444',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          🚫 Flag Spam
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleCopyText(comment.content || comment.text)}
                        style={{
                          borderRadius: '9999px',
                          padding: '6px 12px',
                          fontSize: '0.78rem',
                          background: 'var(--cms-card-bg)',
                          border: '1px solid var(--cms-card-border)',
                          color: 'var(--cms-text-muted)',
                          cursor: 'pointer'
                        }}
                        title="Copy comment text"
                      >
                        📋 Copy Text
                      </button>
                      {comment.blogSlug && (
                        <a
                          href={`/blog/${comment.blogSlug}/`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            borderRadius: '9999px',
                            padding: '6px 12px',
                            fontSize: '0.78rem',
                            background: 'var(--cms-card-bg)',
                            border: '1px solid var(--cms-card-border)',
                            color: 'var(--cms-primary)',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          🔗 View Post
                        </a>
                      )}
                      <button
                        disabled={operatingId === cId}
                        onClick={() => handleDelete(cId)}
                        style={{
                          borderRadius: '9999px',
                          padding: '6px 12px',
                          fontSize: '0.78rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#ef4444',
                          cursor: 'pointer'
                        }}
                        title="Permanently delete comment"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
