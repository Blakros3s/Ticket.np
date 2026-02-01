"use client";

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/auth';
import { User } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';

type UserRow = {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'manager' | 'employee';
  is_active: boolean;
};

function UserRowView({ user }: { user: UserRow }) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-slate-700/50">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center text-white text-xs">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-semibold">{user.username}</div>
          <div className="text-xs text-slate-400">{user.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-slate-300">
        <span className="px-2 py-1 rounded bg-slate-700/40">{user.role}</span>
        <span className={`px-2 py-1 rounded ${user.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  );
}

export default function UserPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', first_name: '', last_name: '', role: 'employee' as User['role'], password: '', confirm_password: '' });
  const [viewUser, setViewUser] = useState<UserRow | null>(null);
  const [editUser, setEditUser] = useState<{ id: number; data: Partial<UserRow> } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [currentUser]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await authApi.getUsers();
      // Normalize to our shape
      setUsers(data as any);
    } catch (e) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const toggleAdd = () => setAddOpen((s) => !s);

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...newUser } as any;
      const res = await (authApi as any).createUser?.(payload);
      if (res?.user) {
        const u = res.user as any;
        setUsers((prev) => [
          { id: u.id, username: u.username, email: u.email, first_name: u.first_name, last_name: u.last_name, role: u.role, is_active: true },
          ...prev,
        ]);
      }
      setAddOpen(false);
      setNewUser({ username: '', email: '', first_name: '', last_name: '', role: 'employee', password: '', confirm_password: '' });
    } catch (err) {
      console.error(err);
      setError('Failed to create user');
    }
  };

  const saveEdit = async () => {
    if (!editUser) return;
    try {
      const res = await (authApi as any).updateUser?.(editUser.id, editUser.data);
      if (res) {
        setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...(editUser.data as any) } : u)));
      }
      setEditUser(null);
    } catch (err) {
      console.error(err);
      setError('Failed to update user');
    }
  };

  const doDelete = async (id: number) => {
    if (!confirm('Delete this user?')) return;
    try {
      await (authApi as any).deleteUser?.(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error(err);
      setError('Failed to delete user');
    }
  };

  const total = users.length;
  const managers = users.filter((u) => u.role === 'manager').length;
  const employees = users.filter((u) => u.role === 'employee').length;

  return (
    <section className="card glow-border rounded-xl p-6 mt-6 bg-slate-900/40">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">User Management</h2>
          <div className="text-sm text-slate-400">Total: {total} • Managers: {managers} • Employees: {employees}</div>
        </div>
        <div className="flex items-center gap-3">
          <input className="input-field w-60" placeholder="Search by name or email" onChange={(e) => {
            const q = e.target.value.toLowerCase();
            // simple client-side search: filter by username/email
            if (!q) return fetchUsers();
            setUsers((prev) => prev.filter((u) => (
              (u.username?.toLowerCase() || '').includes(q) || (u.email?.toLowerCase() || '').includes(q)
            )));
          }} />
          <button className="btn-primary px-4 py-2 rounded-lg" onClick={() => setAddOpen((s) => !s)}>Add User</button>
        </div>
      </div>

      {addOpen && (
        <form className="space-y-3 mb-4 bg-slate-800 p-4 rounded" onSubmit={addUser}>
          <div className="grid grid-cols-2 gap-3">
            <input className="input-field w-full" placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
            <input className="input-field w-full" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input-field w-full" placeholder="First name" value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })} />
            <input className="input-field w-full" placeholder="Last name" value={newUser.last_name} onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className="input-field w-full" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
            </select>
            <input className="input-field w-full" placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input-field w-full" placeholder="Confirm password" type="password" value={newUser.confirm_password} onChange={(e) => setNewUser({ ...newUser, confirm_password: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      )}

      <div className="mt-4 border-t border-slate-700/50 pt-4">
        {loading ? (
          <div className="text-slate-400">Loading users...</div>
        ) : (
          <div className="flex flex-col gap-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded bg-slate-800/40 hover:bg-slate-800/60">
                <UserRowView user={u} />
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 rounded bg-slate-700 text-white text-xs" onClick={() => setViewUser(u)}>View</button>
                  <button className="px-2 py-1 rounded bg-sky-600 text-white text-xs" onClick={() => setEditUser({ id: u.id, data: u })}>Edit</button>
                  <button className="px-2 py-1 rounded bg-red-700 text-white text-xs" onClick={() => doDelete(u.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewUser && (
        <div className="mt-4 bg-slate-800 p-4 rounded">
          <h3 className="text-lg font-semibold text-white mb-2">User Details</h3>
          <UserRowView user={viewUser} />
          <button className="mt-2 px-3 py-1 rounded bg-slate-700 text-white text-sm" onClick={() => setViewUser(null)}>Close</button>
        </div>
      )}

      {editUser && (
        <div className="mt-4 bg-slate-800 p-4 rounded">
          <h3 className="text-lg font-semibold text-white mb-2">Edit User</h3>
          <div className="grid grid-cols-2 gap-3">
            <input className="input-field w-full" placeholder="Username" value={editUser.data.username ?? ''} onChange={(e) => setEditUser({ id: editUser.id, data: { ...editUser.data, username: e.target.value } })} />
            <input className="input-field w-full" placeholder="Email" value={editUser.data.email ?? ''} onChange={(e) => setEditUser({ id: editUser.id, data: { ...editUser.data, email: e.target.value } })} />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <input className="input-field w-full" placeholder="First name" value={editUser.data.first_name ?? ''} onChange={(e) => setEditUser({ id: editUser.id, data: { ...editUser.data, first_name: e.target.value } })} />
            <input className="input-field w-full" placeholder="Last name" value={editUser.data.last_name ?? ''} onChange={(e) => setEditUser({ id: editUser.id, data: { ...editUser.data, last_name: e.target.value } })} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveEdit}>Save</button>
          </div>
        </div>
      )}

      {error && <div className="mt-2 text-red-400">{error}</div>}
    </section>
  );
}
