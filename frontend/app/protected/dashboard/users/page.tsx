'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authApi } from '@/lib/auth';

type UserSystemRole = 'admin' | 'manager' | 'employee';

interface UserRole {
  id: number;
  name: string;
  display_name: string;
  color: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserSystemRole;
  department_roles: UserRole[];
  is_active: boolean;
}

export default function UsersManagementPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [users, setUsers] = useState<User[]>([]);
  const [departmentRoles, setDepartmentRoles] = useState<UserRole[]>([]);

  // Ensure departmentRoles is always an array
  useEffect(() => {
    if (!Array.isArray(departmentRoles)) {
      console.error('departmentRoles is not an array, resetting to empty array');
      setDepartmentRoles([]);
    }
  }, [departmentRoles]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'employee' as UserSystemRole,
    department_role_ids: [] as number[],
    password: '',
    confirm_password: ''
  });

  // Department Role Management State
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [newRole, setNewRole] = useState({
    name: '',
    display_name: '',
    color: '#3b82f6'
  });

  // Delete Confirmation Modal State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'role' | 'user'; id: number; name: string } | null>(null);

  // Password Reset Modal State
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [passwordResetData, setPasswordResetData] = useState({
    new_password: '',
    confirm_password: ''
  });
  const [resetPasswordErrors, setResetPasswordErrors] = useState<string[]>([]);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await authApi.getUsers();
      console.log('Fetched users:', data);
      // Ensure it's an array
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        console.error('Users data is not an array:', data);
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      showToastMessage('Failed to load users', 'error');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentRoles = async () => {
    try {
      const roles = await authApi.getDepartmentRoles();
      console.log('Fetched department roles:', roles);
      // Ensure it's an array
      if (Array.isArray(roles)) {
        setDepartmentRoles(roles);
      } else {
        console.error('Department roles is not an array:', roles);
        setDepartmentRoles([]);
      }
    } catch (error) {
      console.error('Failed to load department roles', error);
      setDepartmentRoles([]);
    }
  };

  // Department Role Management Functions
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('Creating department role with data:', newRole);
      const response = await authApi.createDepartmentRole(newRole);
      console.log('Department role created:', response);
      showToastMessage('Department role created successfully', 'success');
      setShowRoleModal(false);
      setNewRole({ name: '', display_name: '', color: '#3b82f6' });
      fetchDepartmentRoles();
    } catch (error: any) {
      console.error('Error creating department role:', error);
      console.error('Error response:', error.response);
      const errorMessage = error.response?.data?.detail ||
        error.response?.data?.name?.[0] ||
        error.response?.data?.non_field_errors?.[0] ||
        'Failed to create department role';
      showToastMessage(errorMessage, 'error');
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    try {
      await authApi.updateDepartmentRole(selectedRole.id, {
        name: selectedRole.name,
        display_name: selectedRole.display_name,
        color: selectedRole.color
      });
      showToastMessage('Department role updated successfully', 'success');
      setShowRoleModal(false);
      setIsEditingRole(false);
      setSelectedRole(null);
      fetchDepartmentRoles();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail ||
        error.response?.data?.name?.[0] ||
        'Failed to update department role';
      showToastMessage(errorMessage, 'error');
    }
  };

  const handleDeleteRole = async (roleId: number, roleName: string) => {
    setDeleteTarget({ type: 'role', id: roleId, name: roleName });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'role') {
        await authApi.deleteDepartmentRole(deleteTarget.id);
        showToastMessage('Department role deleted successfully', 'success');
        fetchDepartmentRoles();
      } else {
        await authApi.deleteUser(deleteTarget.id);
        showToastMessage('User deleted successfully', 'success');
        fetchUsers();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail ||
        `Failed to delete ${deleteTarget.type}`;
      showToastMessage(errorMessage, 'error');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const openAddRoleModal = () => {
    setIsEditingRole(false);
    setSelectedRole(null);
    setNewRole({ name: '', display_name: '', color: '#3b82f6' });
    setShowRoleModal(true);
  };

  const openEditRoleModal = (role: UserRole) => {
    setIsEditingRole(true);
    setSelectedRole(role);
    setShowRoleModal(true);
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartmentRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wait for auth to load
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Admin guard - must be after all hooks
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-slate-400 mb-6">You don&apos;t have permission to access this page.</p>
          <Link href="/protected/dashboard" className="btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (newUser.password !== newUser.confirm_password) {
        showToastMessage('Passwords do not match', 'error');
        return;
      }

      await authApi.createUser(newUser);
      showToastMessage('User created successfully', 'success');
      setShowAddModal(false);
      setNewUser({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        role: 'employee',
        department_role_ids: [],
        password: '',
        confirm_password: ''
      });
      fetchUsers();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail ||
        error.response?.data?.password?.[0] ||
        error.response?.data?.username?.[0] ||
        error.response?.data?.email?.[0] ||
        'Failed to create user';
      showToastMessage(errorMessage, 'error');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const updateData = {
        username: selectedUser.username,
        email: selectedUser.email,
        first_name: selectedUser.first_name,
        last_name: selectedUser.last_name,
        role: selectedUser.role,
        department_role_ids: selectedUser.department_roles?.map(r => r.id) || []
      };
      await authApi.updateUser(selectedUser.id, updateData);
      showToastMessage('User updated successfully', 'success');
      setShowEditModal(false);
      fetchUsers();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail ||
        error.response?.data?.username?.[0] ||
        error.response?.data?.email?.[0] ||
        'Failed to update user';
      showToastMessage(errorMessage, 'error');
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    setDeleteTarget({ type: 'user', id: userId, name: username });
    setShowDeleteConfirm(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    setResetPasswordErrors([]);
    
    if (passwordResetData.new_password !== passwordResetData.confirm_password) {
      setResetPasswordErrors(['Passwords do not match']);
      return;
    }
    
    if (passwordResetData.new_password.length < 8) {
      setResetPasswordErrors(['Password must be at least 8 characters']);
      return;
    }
    
    setIsResettingPassword(true);
    try {
      await authApi.adminResetPassword(selectedUser.id, {
        new_password: passwordResetData.new_password,
        confirm_password: passwordResetData.confirm_password
      });
      showToastMessage(`Password reset successfully for ${selectedUser.username}`, 'success');
      setShowPasswordResetModal(false);
      setPasswordResetData({ new_password: '', confirm_password: '' });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 
        error.response?.data?.detail ||
        'Failed to reset password';
      setResetPasswordErrors([errorMessage]);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const openPasswordResetModal = (user: User) => {
    setSelectedUser(user);
    setPasswordResetData({ new_password: '', confirm_password: '' });
    setResetPasswordErrors([]);
    setShowPasswordResetModal(true);
  };

  const toggleDepartmentRole = (roleId: number, isNewUser: boolean = false) => {
    if (isNewUser) {
      setNewUser(prev => {
        const currentIds = prev.department_role_ids;
        if (currentIds.includes(roleId)) {
          return { ...prev, department_role_ids: currentIds.filter(id => id !== roleId) };
        } else {
          return { ...prev, department_role_ids: [...currentIds, roleId] };
        }
      });
    } else if (selectedUser) {
      setSelectedUser(prev => {
        if (!prev) return prev;
        const currentRoles = prev.department_roles || [];
        const roleExists = currentRoles.some(r => r.id === roleId);

        if (roleExists) {
          return { ...prev, department_roles: currentRoles.filter(r => r.id !== roleId) };
        } else {
          const roleToAdd = departmentRoles.find(r => r.id === roleId);
          if (roleToAdd) {
            return { ...prev, department_roles: [...currentRoles, roleToAdd] };
          }
        }
        return prev;
      });
    }
  };

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.username.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.first_name?.toLowerCase().includes(query) ||
      user.last_name?.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query) ||
      user.department_roles?.some(r => r.display_name.toLowerCase().includes(query))
    );
  });

  const totalUsers = users.length;
  const totalManagers = users.filter(u => u.role === 'manager').length;
  const totalEmployees = users.filter(u => u.role === 'employee').length;
  const totalAdmins = users.filter(u => u.role === 'admin').length;
  const totalDepartmentRoles = departmentRoles.length;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/protected/dashboard" className="text-slate-400 hover:text-white transition-colors">
            Dashboard
          </Link>
          <span className="text-slate-500">/</span>
          <span className="text-white">User Management</span>
        </div>
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        <p className="text-slate-400 mt-1">Manage system users, roles and permissions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Users</p>
              <p className="text-2xl font-bold text-white mt-1">{totalUsers}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Administrators</p>
              <p className="text-2xl font-bold text-white mt-1">{totalAdmins}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Managers</p>
              <p className="text-2xl font-bold text-white mt-1">{totalManagers}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Employees</p>
              <p className="text-2xl font-bold text-white mt-1">{totalEmployees}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Dept Roles</p>
              <p className="text-2xl font-bold text-white mt-1">{totalDepartmentRoles}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Department Roles Management */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Department Roles</h2>
            <p className="text-slate-400 text-sm mt-1">Manage department roles like Frontend, Backend, DevOps, etc.</p>
          </div>
          <button
            type="button"
            onClick={openAddRoleModal}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Role
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          {Array.isArray(departmentRoles) && departmentRoles.length > 0 ? (
            departmentRoles.map((role) => (
              <div
                key={role.id}
                className="group flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all hover:shadow-lg"
                style={{
                  backgroundColor: `${role.color}15`,
                  borderColor: `${role.color}60`,
                }}
              >
                <span
                  className="w-3 h-3 rounded-full ring-2 ring-offset-1 ring-offset-slate-800"
                  style={{ backgroundColor: role.color, '--tw-ring-color': role.color } as React.CSSProperties}
                />
                <span className="text-sm font-semibold" style={{ color: role.color }}>
                  {role.display_name}
                </span>
                <span className="text-xs text-slate-500 ml-1">({role.name})</span>
                <div className="flex items-center gap-1 ml-2 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => openEditRoleModal(role)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                    title="Edit Role"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRole(role.id, role.display_name)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="Delete Role"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="w-full text-center py-6 bg-slate-900/30 rounded-lg border border-dashed border-slate-700">
              <svg className="w-10 h-10 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <p className="text-slate-500 text-sm mb-1">No department roles defined yet</p>
              <p className="text-slate-600 text-xs">Create roles like Frontend, Backend, DevOps, etc.</p>
            </div>
          )}
        </div>
      </div>

      {/* Search and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search users by name, email, role or department..."
            className="input-field w-full pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Add User button clicked');
            setShowAddModal(true);
          }}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400 mx-auto"></div>
            <p className="text-slate-400 mt-4">Loading users...</p>
          </div>
        ) : !Array.isArray(filteredUsers) ? (
          <div className="p-8 text-center">
            <p className="text-slate-400">Error loading users data</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-slate-400">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">System Role</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Department Roles</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {Array.isArray(filteredUsers) && filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-semibold text-sm">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-white">{user.username}</div>
                          <div className="text-sm text-slate-400">{user.first_name} {user.last_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-300">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                        user.role === 'manager' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.department_roles && user.department_roles.length > 0 ? (
                          user.department_roles.map((role) => (
                            <span
                              key={role.id}
                              className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: `${role.color}20`,
                                color: role.color,
                                border: `1px solid ${role.color}40`
                              }}
                            >
                              {role.display_name}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-sm">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('View button clicked for user:', user.username);
                            setSelectedUser({ ...user, department_roles: user.department_roles || [] });
                            setShowViewModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
                          title="View"
                        >
                          <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Edit button clicked for user:', user.username);
                            setSelectedUser({ ...user, department_roles: user.department_roles || [] });
                            setShowEditModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-all cursor-pointer"
                          title="Edit"
                        >
                          <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openPasswordResetModal(user);
                          }}
                          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
                          title="Reset Password"
                        >
                          <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteUser(user.id, user.username);
                          }}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                          title="Delete"
                        >
                          <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Add New User</h2>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    className="input-field w-full"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="johndoe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    className="input-field w-full"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">First Name</label>
                  <input
                    type="text"
                    className="input-field w-full"
                    value={newUser.first_name}
                    onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    className="input-field w-full"
                    value={newUser.last_name}
                    onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">System Role *</label>
                <select
                  className="input-field w-full"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserSystemRole })}
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Department Roles</label>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                  {Array.isArray(departmentRoles) && departmentRoles.length > 0 ? (
                    departmentRoles.map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          toggleDepartmentRole(role.id, true);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${newUser.department_role_ids.includes(role.id)
                          ? 'ring-2 ring-offset-2 ring-offset-slate-800 shadow-lg'
                          : 'opacity-50 hover:opacity-80'
                          }`}
                        style={{
                          backgroundColor: newUser.department_role_ids.includes(role.id) ? `${role.color}40` : `${role.color}15`,
                          color: newUser.department_role_ids.includes(role.id) ? role.color : `${role.color}cc`,
                          border: `2px solid ${newUser.department_role_ids.includes(role.id) ? role.color : `${role.color}40`}`,
                        }}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: role.color }}
                          />
                          {role.display_name}
                          {newUser.department_role_ids.includes(role.id) && (
                            <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="w-full text-center py-2">
                      <p className="text-slate-500 text-sm">No department roles available.</p>
                      <button
                        type="button"
                        onClick={() => { setShowAddModal(false); openAddRoleModal(); }}
                        className="text-sky-400 hover:text-sky-300 text-sm mt-1 underline"
                      >
                        Create department roles first →
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Click on roles to select/deselect them for this user</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    className="input-field w-full"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    className="input-field w-full"
                    value={newUser.confirm_password}
                    onChange={(e) => setNewUser({ ...newUser, confirm_password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary px-4 py-2 rounded-lg cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Edit User</h2>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                  <input
                    type="text"
                    className="input-field w-full"
                    value={selectedUser.username}
                    onChange={(e) => setSelectedUser({ ...selectedUser, username: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    className="input-field w-full"
                    value={selectedUser.email}
                    onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">First Name</label>
                  <input
                    type="text"
                    className="input-field w-full"
                    value={selectedUser.first_name || ''}
                    onChange={(e) => setSelectedUser({ ...selectedUser, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    className="input-field w-full"
                    value={selectedUser.last_name || ''}
                    onChange={(e) => setSelectedUser({ ...selectedUser, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">System Role</label>
                <select
                  className="input-field w-full"
                  value={selectedUser.role}
                  onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value as UserSystemRole })}
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Department Roles</label>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                  {Array.isArray(departmentRoles) && departmentRoles.length > 0 ? (
                    departmentRoles.map((role) => {
                      const isSelected = selectedUser.department_roles?.some(r => r.id === role.id) || false;
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            toggleDepartmentRole(role.id, false);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${isSelected
                            ? 'ring-2 ring-offset-2 ring-offset-slate-800 shadow-lg'
                            : 'opacity-50 hover:opacity-80'
                            }`}
                          style={{
                            backgroundColor: isSelected ? `${role.color}40` : `${role.color}15`,
                            color: isSelected ? role.color : `${role.color}cc`,
                            border: `2px solid ${isSelected ? role.color : `${role.color}40`}`,
                          }}
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: role.color }}
                            />
                            {role.display_name}
                            {isSelected && (
                              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="w-full text-center py-2">
                      <p className="text-slate-500 text-sm">No department roles available.</p>
                      <button
                        type="button"
                        onClick={() => { setShowEditModal(false); openAddRoleModal(); }}
                        className="text-sky-400 hover:text-sky-300 text-sm mt-1 underline"
                      >
                        Create department roles first →
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Click on roles to select/deselect them for this user</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary px-4 py-2 rounded-lg cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View User Modal */}
      {showViewModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">User Details</h2>
                <button
                  type="button"
                  onClick={() => setShowViewModal(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-bold text-2xl">
                  {selectedUser.username.charAt(0).toUpperCase()}
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-white">{selectedUser.username}</h3>
                  <p className="text-slate-400">{selectedUser.email}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Full Name</span>
                  <span className="text-white">{selectedUser.first_name} {selectedUser.last_name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">System Role</span>
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${selectedUser.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                    selectedUser.role === 'manager' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                    {selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Department Roles</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {selectedUser.department_roles && selectedUser.department_roles.length > 0 ? (
                      selectedUser.department_roles.map((role) => (
                        <span
                          key={role.id}
                          className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `${role.color}20`,
                            color: role.color,
                            border: `1px solid ${role.color}40`
                          }}
                        >
                          {role.display_name}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500 text-sm">-</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Status</span>
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${selectedUser.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                    {selectedUser.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="w-full mt-6 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Department Role Modal (Add/Edit) */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  {isEditingRole ? 'Edit Department Role' : 'Add Department Role'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={isEditingRole ? handleUpdateRole : handleCreateRole} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Role Key (internal name) *</label>
                <input
                  type="text"
                  required
                  disabled={isEditingRole}
                  className="input-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  value={isEditingRole ? selectedRole?.name : newRole.name}
                  onChange={(e) => isEditingRole
                    ? setSelectedRole(prev => prev ? { ...prev, name: e.target.value } : null)
                    : setNewRole({ ...newRole, name: e.target.value })
                  }
                  placeholder="e.g., frontend, backend, devops"
                />
                <p className="text-xs text-slate-500 mt-1">Use lowercase letters and underscores only</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Display Name *</label>
                <input
                  type="text"
                  required
                  className="input-field w-full"
                  value={isEditingRole ? selectedRole?.display_name : newRole.display_name}
                  onChange={(e) => isEditingRole
                    ? setSelectedRole(prev => prev ? { ...prev, display_name: e.target.value } : null)
                    : setNewRole({ ...newRole, display_name: e.target.value })
                  }
                  placeholder="e.g., Frontend Developer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Color *</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    required
                    className="w-12 h-10 rounded cursor-pointer bg-transparent border-0"
                    value={isEditingRole ? selectedRole?.color : newRole.color}
                    onChange={(e) => isEditingRole
                      ? setSelectedRole(prev => prev ? { ...prev, color: e.target.value } : null)
                      : setNewRole({ ...newRole, color: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    required
                    className="input-field flex-1"
                    value={isEditingRole ? selectedRole?.color : newRole.color}
                    onChange={(e) => isEditingRole
                      ? setSelectedRole(prev => prev ? { ...prev, color: e.target.value } : null)
                      : setNewRole({ ...newRole, color: e.target.value })
                    }
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary px-4 py-2 rounded-lg cursor-pointer"
                >
                  {isEditingRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl transform transition-all">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Delete {deleteTarget.type === 'role' ? 'Department Role' : 'User'}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-4 mb-6 border border-slate-700">
                <p className="text-slate-300">
                  {deleteTarget.type === 'role'
                    ? <>Are you sure you want to delete the role <span className="text-white font-semibold">&quot;{deleteTarget.name}&quot;</span>? This will remove it from all users.</>
                    : <>Are you sure you want to delete user <span className="text-white font-semibold">&quot;{deleteTarget.name}&quot;</span>?</>
                  }
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteTarget(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Password Reset Modal */}
      {showPasswordResetModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Reset Password</h2>
                  <p className="text-sm text-slate-400 mt-1">Reset password for {selectedUser.username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordResetModal(false);
                    setPasswordResetData({ new_password: '', confirm_password: '' });
                    setResetPasswordErrors([]);
                  }}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              {resetPasswordErrors.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  {resetPasswordErrors.map((err, idx) => (
                    <p key={idx} className="text-red-400 text-sm">{err}</p>
                  ))}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  className="input-field w-full"
                  value={passwordResetData.new_password}
                  onChange={(e) => setPasswordResetData({ ...passwordResetData, new_password: e.target.value })}
                  placeholder="Enter new password"
                />
                <p className="text-xs text-slate-500 mt-1">Minimum 8 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  className="input-field w-full"
                  value={passwordResetData.confirm_password}
                  onChange={(e) => setPasswordResetData({ ...passwordResetData, confirm_password: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordResetModal(false);
                    setPasswordResetData({ new_password: '', confirm_password: '' });
                    setResetPasswordErrors([]);
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors font-medium cursor-pointer disabled:opacity-50"
                >
                  {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
