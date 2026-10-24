import React, { useState, useEffect } from 'react';

const AVAILABLE_PERMISSIONS = [
  { id: 'posts.view', label: 'View Posts', group: 'Content' },
  { id: 'posts.create', label: 'Create Drafts', group: 'Content' },
  { id: 'posts.edit', label: 'Edit Articles', group: 'Content' },
  { id: 'posts.publish', label: 'Publish / Schedule', group: 'Content' },
  { id: 'posts.delete', label: 'Delete Posts', group: 'Content' },
  { id: 'categories.manage', label: 'Manage Categories & Tags', group: 'Content' },

  { id: 'products.view', label: 'View Machinery Products', group: 'Catalog' },
  { id: 'products.create', label: 'Add New Products', group: 'Catalog' },
  { id: 'products.edit', label: 'Edit Product Details & Specs', group: 'Catalog' },
  { id: 'products.delete', label: 'Delete Products', group: 'Catalog' },

  { id: 'media.view', label: 'View Media Files', group: 'Media' },
  { id: 'media.upload', label: 'Upload Images & Files', group: 'Media' },
  { id: 'media.delete', label: 'Delete Media', group: 'Media' },

  { id: 'users.view', label: 'View Users List', group: 'Access & Security' },
  { id: 'users.create', label: 'Invite / Create Users', group: 'Access & Security' },
  { id: 'users.edit', label: 'Edit User Roles & Status', group: 'Access & Security' },
  { id: 'users.delete', label: 'Delete Accounts', group: 'Access & Security' },
  { id: 'security.view', label: 'View Security Logs', group: 'Access & Security' },
  { id: 'security.manage', label: 'Manage Firewall & Sessions', group: 'Access & Security' },
  { id: 'settings.manage', label: 'Manage CMS Settings', group: 'Access & Security' },
];

export default function CmsUserManager({ csrfToken, currentUser }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'roles'
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // User Modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState('');
  const [userForm, setUserForm] = useState(getEmptyUser());

  // Role Modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState('');
  const [roleForm, setRoleForm] = useState(getEmptyRole());

  function getEmptyUser() {
    return {
      id: '',
      username: '',
      email: '',
      full_name: '',
      role: 'editor',
      status: 'active',
      password: ''
    };
  }

  function getEmptyRole() {
    return {
      id: '',
      name: '',
      display_name: '',
      description: '',
      permissions: []
    };
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/cms.php?action=users_list');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (err) {}
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/cms.php?action=roles_list');
      const data = await res.json();
      if (data.success) {
        setRoles(data.roles || []);
      }
    } catch (err) {}
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchUsers(), fetchRoles()]).finally(() => setLoading(false));
  }, []);

  const handleOpenCreateUser = () => {
    setEditingUserId('');
    setUserForm(getEmptyUser());
    setShowUserModal(true);
  };

  const handleOpenEditUser = (user) => {
    setEditingUserId(user.id);
    setUserForm({
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name || '',
      role: user.role,
      status: user.status,
      password: ''
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/cms.php?action=user_save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(userForm)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save user.');
      }
      setShowUserModal(false);
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (id, username) => {
    if (!confirm(`Delete user "${username}"?`)) return;
    try {
      const res = await fetch('/api/cms.php?action=user_delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error || 'Failed to delete user.');
      }
    } catch (err) {
      alert('Error deleting user');
    }
  };

  // Role Handlers
  const handleOpenCreateRole = () => {
    setEditingRoleId('');
    setRoleForm(getEmptyRole());
    setShowRoleModal(true);
  };

  const handleOpenEditRole = (role) => {
    setEditingRoleId(role.id);
    setRoleForm({
      id: role.id,
      name: role.name,
      display_name: role.display_name,
      description: role.description || '',
      permissions: role.permissions || []
    });
    setShowRoleModal(true);
  };

  const togglePermission = (permId) => {
    setRoleForm(prev => {
      const perms = [...prev.permissions];
      const idx = perms.indexOf(permId);
      if (idx > -1) {
        perms.splice(idx, 1);
      } else {
        perms.push(permId);
      }
      return { ...prev, permissions: perms };
    });
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/cms.php?action=role_save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(roleForm)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save role.');
      }
      setShowRoleModal(false);
      fetchRoles();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteRole = async (id, name) => {
    if (!confirm(`Delete custom role "${name}"?`)) return;
    try {
      const res = await fetch('/api/cms.php?action=role_delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        fetchRoles();
      } else {
        alert(data.error || 'Failed to delete role.');
      }
    } catch (err) {
      alert('Error deleting role');
    }
  };

  return (
    <div>
      <div className="cms-section-header">
        <div className="cms-section-title-group">
          <h1>Users & Permission Management</h1>
          <p>Configure administrative team members and granular role access controls</p>
        </div>
        <div className="cms-section-actions">
          {activeTab === 'users' ? (
            <button className="cms-btn cms-btn-primary" onClick={handleOpenCreateUser}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              <span>Add New User</span>
            </button>
          ) : (
            <button className="cms-btn cms-btn-primary" onClick={handleOpenCreateRole}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              <span>Create Custom Role</span>
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--cms-card-border)', marginBottom: '20px' }}>
        <button
          className={`cms-btn ${activeTab === 'users' ? 'cms-btn-primary' : 'cms-btn-secondary'}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Team Members ({users.length})
        </button>
        <button
          className={`cms-btn ${activeTab === 'roles' ? 'cms-btn-primary' : 'cms-btn-secondary'}`}
          onClick={() => setActiveTab('roles')}
        >
          🛡️ Roles & Permissions ({roles.length})
        </button>
      </div>

      {/* USERS TABLE */}
      {activeTab === 'users' && (
        <div className="cms-table-wrapper">
          <div className="cms-table-responsive">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Failed Logins</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>Loading team members...</td></tr>
                ) : (
                  users.map((u) => {
                    const isSuper = u.role === 'super_admin';
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: '600', color: 'var(--cms-text)' }}>
                            {u.full_name || u.username}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--cms-text-subtle)' }}>
                            {u.email} · @{u.username}
                          </div>
                        </td>
                        <td>
                          <span className={`cms-badge ${isSuper ? 'cms-badge-warning' : 'cms-badge-info'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span className={`cms-badge ${u.status === 'active' ? 'cms-badge-success' : 'cms-badge-danger'}`}>
                            {u.status}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: u.failed_login_attempts > 5 ? 'var(--cms-danger)' : 'var(--cms-text-muted)' }}>
                            {u.failed_login_attempts || 0} / 10
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--cms-text-subtle)', fontFamily: 'var(--cms-font-mono)' }}>
                          {u.last_login_at ? new Date(u.last_login_at * 1000).toLocaleString() : 'Never'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="cms-btn cms-btn-secondary cms-btn-sm"
                              onClick={() => handleOpenEditUser(u)}
                            >
                              Edit
                            </button>
                            {!isSelf && (
                              <button
                                className="cms-btn cms-btn-danger cms-btn-sm"
                                onClick={() => handleDeleteUser(u.id, u.username)}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ROLES LIST */}
      {activeTab === 'roles' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
          {roles.map((r) => {
            const isSystem = Boolean(r.is_system);
            return (
              <div key={r.id} className="cms-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700' }}>{r.display_name}</h3>
                  <span className={`cms-badge ${isSystem ? 'cms-badge-muted' : 'cms-badge-info'}`}>
                    {isSystem ? 'System' : 'Custom'}
                  </span>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--cms-text-muted)', minHeight: '38px', margin: '0 0 14px' }}>
                  {r.description || 'Custom administrative role.'}
                </p>
                <div style={{ fontSize: '0.76rem', color: 'var(--cms-text-subtle)', marginBottom: '14px' }}>
                  <strong>Permissions: </strong>
                  {r.permissions.includes('*') ? 'Unrestricted (Full Access)' : `${r.permissions.length} granted`}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="cms-btn cms-btn-secondary cms-btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => handleOpenEditRole(r)}
                  >
                    Configure
                  </button>
                  {!isSystem && (
                    <button
                      className="cms-btn cms-btn-danger cms-btn-sm"
                      onClick={() => handleDeleteRole(r.id, r.display_name)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT USER MODAL */}
      {showUserModal && (
        <div className="cms-modal-backdrop">
          <div className="cms-modal" style={{ maxWidth: '480px' }}>
            <div className="cms-modal-header">
              <h3>{editingUserId ? `Edit User: ${userForm.username}` : 'Add Team Member'}</h3>
              <button className="cms-btn-icon cms-btn-secondary" onClick={() => setShowUserModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div className="cms-modal-body">
                <div className="cms-form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    className="cms-input"
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    required
                  />
                </div>
                <div className="cms-form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    className="cms-input"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="cms-form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    className="cms-input"
                    value={userForm.full_name}
                    onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  />
                </div>
                <div className="cms-form-group">
                  <label>Role</label>
                  <select
                    className="cms-select"
                    style={{ width: '100%' }}
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.name}>{r.display_name}</option>
                    ))}
                  </select>
                </div>
                <div className="cms-form-group">
                  <label>Status</label>
                  <select
                    className="cms-select"
                    style={{ width: '100%' }}
                    value={userForm.status}
                    onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive / Suspended</option>
                  </select>
                </div>
                <div className="cms-form-group">
                  <label>{editingUserId ? 'Reset Password (leave empty to keep current)' : 'Password *'}</label>
                  <input
                    type="password"
                    className="cms-input"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder={editingUserId ? '••••••••••••' : 'Min 8 characters'}
                    required={!editingUserId}
                  />
                </div>
              </div>
              <div className="cms-modal-footer">
                <button type="button" className="cms-btn cms-btn-secondary" onClick={() => setShowUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="cms-btn cms-btn-primary">
                  {editingUserId ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM ROLE BUILDER MODAL */}
      {showRoleModal && (
        <div className="cms-modal-backdrop">
          <div className="cms-modal cms-modal-lg" style={{ maxHeight: '90vh' }}>
            <div className="cms-modal-header">
              <h3>{editingRoleId ? `Configure Role: ${roleForm.display_name}` : 'Create Custom Role'}</h3>
              <button className="cms-btn-icon cms-btn-secondary" onClick={() => setShowRoleModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveRole}>
              <div className="cms-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div className="cms-form-group">
                    <label>Role Identifier (system key) *</label>
                    <input
                      type="text"
                      className="cms-input"
                      value={roleForm.name}
                      onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                      required
                      disabled={Boolean(editingRoleId)}
                      placeholder="e.g. content_reviewer"
                    />
                  </div>
                  <div className="cms-form-group">
                    <label>Display Name *</label>
                    <input
                      type="text"
                      className="cms-input"
                      value={roleForm.display_name}
                      onChange={(e) => setRoleForm({ ...roleForm, display_name: e.target.value })}
                      required
                      placeholder="e.g. Content Reviewer"
                    />
                  </div>
                </div>

                <div className="cms-form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    className="cms-input"
                    value={roleForm.description}
                    onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                    placeholder="Describe privileges granted to this role..."
                  />
                </div>

                <h4 style={{ margin: '20px 0 12px', fontSize: '0.92rem' }}>Granular Permission Grants</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const checked = roleForm.permissions.includes(perm.id) || roleForm.permissions.includes('*');
                    return (
                      <label
                        key={perm.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          background: 'var(--cms-bg-subtle)',
                          border: '1px solid var(--cms-card-border)',
                          borderRadius: 'var(--cms-radius-md)',
                          cursor: 'pointer',
                          fontSize: '0.82rem'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={roleForm.permissions.includes('*')}
                          onChange={() => togglePermission(perm.id)}
                          style={{ accentColor: 'var(--cms-primary)' }}
                        />
                        <div>
                          <div style={{ fontWeight: '600' }}>{perm.label}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--cms-text-subtle)' }}><code>{perm.id}</code></div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="cms-modal-footer">
                <button type="button" className="cms-btn cms-btn-secondary" onClick={() => setShowRoleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="cms-btn cms-btn-primary">
                  Save Role Permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
