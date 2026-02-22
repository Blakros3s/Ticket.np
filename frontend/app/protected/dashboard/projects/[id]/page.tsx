'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { projectsApi, Project, ProjectDocument } from '@/lib/projects';
import { authApi, User } from '@/lib/auth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as mammoth from 'mammoth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const getFileUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);

  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editForm, setEditForm] = useState({ name: '', description: '', github_repo: '', status: 'active' as 'active' | 'archived' });
  const [isSaving, setIsSaving] = useState(false);

  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<ProjectDocument | null>(null);
  const [viewingContent, setViewingContent] = useState<string | null>(null);
  const [isViewingLoading, setIsViewingLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showRemoveMember, setShowRemoveMember] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ id: number; name: string } | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  const isManager = user?.role === 'manager' || user?.role === 'admin';

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await projectsApi.getProject(projectId);
      setProject(data);
      setEditForm({ name: data.name, description: data.description, github_repo: data.github_repo || '', status: data.status });

      const docs = await projectsApi.getDocuments(projectId);
      setDocuments(docs);

      if (isManager) {
        const users = await authApi.getUsers();
        setAllUsers(users);
      }
    } catch (error) {
      showToastMessage('Failed to load project details', 'error');
      router.push('/protected/dashboard/projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isManager]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) return;
    setIsAdding(true);
    try {
      await Promise.all(selectedUserIds.map(id => projectsApi.addMember(projectId, Number(id))));
      showToastMessage(`Successfully added ${selectedUserIds.length} member(s)`, 'success');
      setShowAddMember(false);
      setSelectedUserIds([]);
      setSearchQuery('');
      await fetchData();
    } catch (error: any) {
      showToastMessage(error.message || 'Failed to add one or more members', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsRemovingMember(true);
    try {
      await projectsApi.removeMember(projectId, memberToRemove.id);
      showToastMessage(`${memberToRemove.name} has been removed from the project`, 'success');
      setShowRemoveMember(false);
      setMemberToRemove(null);
      await fetchData();
    } catch (error: any) {
      showToastMessage(error.response?.data?.error || error.message || 'Failed to remove member', 'error');
    } finally {
      setIsRemovingMember(false);
    }
  };

  const openRemoveMemberModal = (userId: number, userName: string) => {
    setMemberToRemove({ id: userId, name: userName });
    setShowRemoveMember(true);
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await projectsApi.updateProject(projectId, editForm);
      showToastMessage('Project updated successfully', 'success');
      setShowEditProject(false);
      fetchData();
    } catch (error: any) {
      showToastMessage(error.response?.data?.error || 'Failed to update project', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile || !docTitle.trim()) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', docTitle);
      formData.append('file', docFile);

      await projectsApi.uploadDocument(projectId, formData);
      showToastMessage('Document uploaded successfully', 'success');
      setShowUploadDoc(false);
      setDocTitle('');
      setDocFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchData();
    } catch (error: any) {
      showToastMessage(error.response?.data?.error || 'Failed to upload document', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await projectsApi.deleteDocument(projectId, docId);
      showToastMessage('Document deleted successfully', 'success');
      fetchData();
    } catch (error: any) {
      showToastMessage(error.response?.data?.error || 'Failed to delete document', 'error');
    }
  };

  const handleDownload = async (doc: ProjectDocument) => {
    try {
      const response = await fetch(getFileUrl(doc.file));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.title || 'document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      showToastMessage('Failed to download document', 'error');
    }
  };

  const handleViewDoc = async (doc: ProjectDocument) => {
    setViewingDoc(doc);
    const ext = getFileUrl(doc.file).split('.').pop()?.toLowerCase();

    if (ext === 'md' || ext === 'txt') {
      setIsViewingLoading(true);
      try {
        const response = await fetch(getFileUrl(doc.file));
        const text = await response.text();
        setViewingContent(text);
      } catch (error) {
        console.error('Failed to fetch document content:', error);
        setViewingContent('Failed to load content.');
      } finally {
        setIsViewingLoading(false);
      }
    } else if (ext === 'docx') {
      setIsViewingLoading(true);
      try {
        const response = await fetch(getFileUrl(doc.file));
        const arrayBuffer = await response.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setViewingContent(result.value);
      } catch (error) {
        console.error('Failed to convert Word document:', error);
        setViewingContent('Failed to convert Word document.');
      } finally {
        setIsViewingLoading(false);
      }
    } else {
      setViewingContent(null);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!docTitle.trim()) {
        setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      setDocFile(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" /></svg>;
      case 'doc':
      case 'docx':
        return <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h7v5h5v11H6z" /></svg>;
      case 'md':
        return <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24"><path d="M20.56 18H3.44A1.44 1.44 0 0 1 2 16.56V7.44A1.44 1.44 0 0 1 3.44 6h17.12A1.44 1.44 0 0 1 22 7.44v9.12A1.44 1.44 0 0 1 20.56 18zM5.56 8h4.89v1.11h-4.89V8zm0 2.22h8.89v1.11h-8.89v-1.11zm0 2.23h8.89v1.1h-8.89v-1.1zm0 2.22h4.89v1.11h-4.89v-1.11z" /></svg>;
      case 'image':
        return <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" /></svg>;
      default:
        return <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" /></svg>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-700 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-sky-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const availableUsers = allUsers.filter(u => !project.members.some(m => m.user.id === u.id));
  const filteredAvailableUsers = availableUsers.filter(u =>
    `${u.first_name} ${u.last_name} ${u.username}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {toast && (
        <div className={`fixed top-6 right-4 z-[9999] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600 border border-emerald-500' : 'bg-red-600 border border-red-500'} text-white shadow-xl`}>
          {toast.type === 'success' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <nav className="flex items-center gap-2 text-sm mb-6">
        <Link href="/protected/dashboard" className="text-slate-500 hover:text-sky-400 transition-colors">Dashboard</Link>
        <span className="text-slate-600">›</span>
        <Link href="/protected/dashboard/projects" className="text-slate-500 hover:text-sky-400 transition-colors">Projects</Link>
        <span className="text-slate-600">›</span>
        <span className="text-slate-300 truncate max-w-[150px]">{project.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 border border-slate-700/50 p-6">
            <div className="absolute top-0 right-0 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"></div>

            <div className="relative flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{project.name}</h1>
                  <span className={`px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${project.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                    {project.status}
                  </span>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed mb-4 max-w-xl">
                  {project.description || 'No description provided.'}
                </p>
                {project.github_repo && (
                  <a
                    href={project.github_repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 rounded-lg text-sm text-sky-400 transition-all mb-4"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    View Repository
                  </a>
                )}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <span>By {project.created_by.first_name} {project.created_by.last_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span>{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              {isManager && (
                <button
                  onClick={() => setShowEditProject(true)}
                  className="p-2.5 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-600/50 hover:border-slate-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                Team Members
                <span className="text-xs font-medium text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">{project.member_count}</span>
              </h2>
              {isManager && (
                <button
                  onClick={() => setShowAddMember(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-sky-500/20"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add
                </button>
              )}
            </div>

            {project.members.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-700/50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                </div>
                <p className="text-slate-400 text-sm">No members yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                {project.members.map((member) => (
                  <div
                    key={member.id}
                    className="group relative flex items-center gap-4 bg-slate-700/30 hover:bg-slate-700/60 border border-slate-600/30 hover:border-slate-500/50 rounded-2xl px-4 py-3 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-white truncate">
                          {member.user.first_name} {member.user.last_name}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {member.user.department_roles && member.user.department_roles.length > 0 ? (
                            member.user.department_roles.map(role => (
                              <span key={role.id} className="text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20">
                                {role.display_name}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 capitalize">
                              {member.user.role}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        @{member.user.username}
                      </p>
                    </div>
                    {isManager && member.user.id !== project.created_by.id && (
                      <button
                        onClick={() => openRemoveMemberModal(member.user.id, member.user.username)}
                        className="p-2 rounded-xl hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                        title="Remove member"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Documents
                <span className="text-xs font-medium text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">{documents.length}</span>
              </h2>
              <button
                onClick={() => setShowUploadDoc(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                Upload
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-700/50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                </div>
                <p className="text-slate-400 text-sm mb-2">No documents yet</p>
                <p className="text-slate-500 text-xs">Upload PDF, Word, Markdown, or image files</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="group flex items-center gap-3 p-3 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/30 hover:border-slate-500/50 rounded-xl transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                      {getFileIcon(doc.file_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{doc.title}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleViewDoc(doc)}
                        className="p-2 rounded-lg hover:bg-sky-500/20 text-slate-400 hover:text-sky-400 transition-colors"
                        title="View"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="p-2 rounded-lg hover:bg-green-500/20 text-slate-400 hover:text-green-400 transition-colors"
                        title="Download"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-sky-500/20 to-purple-500/20 border border-sky-500/20 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Project Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Members</span>
                <span className="text-lg font-bold text-white">{project.member_count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Tickets</span>
                <span className="text-lg font-bold text-white">{project.ticket_count || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Documents</span>
                <span className="text-lg font-bold text-white">{documents.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Status</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-md ${project.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {project.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Created</span>
                <span className="text-xs text-slate-300">{new Date(project.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {project.github_repo && (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Repository</h3>
              <a
                href={project.github_repo}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/30 rounded-xl transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.303-.535-221-.124-.1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-sky-400 transition-colors">GitHub Repository</p>
                  <p className="text-xs text-slate-500 truncate">{project.github_repo.replace('https://github.com/', '')}</p>
                </div>
                <svg className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
              </a>
            </div>
          )}

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => setShowAddMember(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-xl transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                Add Members
              </button>
              <button
                onClick={() => setShowUploadDoc(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium rounded-xl transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                Upload Doc
              </button>
              {isManager && (
                <button
                  onClick={() => setShowEditProject(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-all border border-slate-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  Edit Project
                </button>
              )}
              <Link
                href="/protected/dashboard/tickets"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-all border border-slate-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>
                View Tickets
              </Link>
            </div>
          </div>
        </div>
      </div>

      {
        showAddMember && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
                <div>
                  <h3 className="text-lg font-bold text-white">Add Team Members</h3>
                  <p className="text-xs text-slate-400">Select multiple people at once</p>
                </div>
                <button
                  onClick={() => { setShowAddMember(false); setSelectedUserIds([]); setSearchQuery(''); }}
                  className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              <div className="p-4 max-h-[60vh] overflow-y-auto">
                <div className="relative mb-4">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  <input
                    type="text"
                    placeholder="Search users..."
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {selectedUserIds.length > 0 && (
                  <div className="mb-4 p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-sky-400">{selectedUserIds.length} selected</span>
                      <button onClick={() => setSelectedUserIds([])} className="text-xs text-slate-400 hover:text-white">Clear</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedUserIds.map(id => {
                        const u = availableUsers.find(x => x.id === Number(id));
                        if (!u) return null;
                        return (
                          <span key={id} className="inline-flex items-center gap-1 bg-sky-500/20 text-sky-300 text-xs px-2 py-1 rounded-full">
                            {u.first_name} {u.last_name}
                            <button onClick={() => toggleUserSelection(id)} className="hover:text-white">×</button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {availableUsers.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">All users are already in this project</p>
                ) : filteredAvailableUsers.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">No users match your search</p>
                ) : (
                  <div className="space-y-2">
                    {filteredAvailableUsers.map(u => {
                      const idStr = String(u.id);
                      const isSelected = selectedUserIds.includes(idStr);
                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleUserSelection(idStr)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${isSelected ? 'bg-sky-500/10 border-sky-500/50' : 'bg-slate-700/30 border-slate-600/50 hover:border-slate-500'}`}
                        >
                          <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-sky-500 border-sky-500' : 'border-slate-500'}`}>
                            {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="text-sm font-bold text-white truncate">{u.username}</p>
                              <div className="flex flex-wrap gap-1">
                                {u.department_roles && u.department_roles.length > 0 ? (
                                  u.department_roles.map(role => (
                                    <span key={role.id} className="text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20">
                                      {role.display_name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 capitalize">
                                    {u.role}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-slate-500 truncate">{u.first_name} {u.last_name}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex gap-3">
                <button
                  onClick={() => { setShowAddMember(false); setSelectedUserIds([]); setSearchQuery(''); }}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMember}
                  disabled={selectedUserIds.length === 0 || isAdding}
                  className="flex-1 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAdding ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Adding...
                    </>
                  ) : (
                    `Add ${selectedUserIds.length > 0 ? selectedUserIds.length : ''} Members`
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        showUploadDoc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
                <div>
                  <h3 className="text-lg font-bold text-white">Upload Document</h3>
                  <p className="text-xs text-slate-400">PDF, Word, Markdown, or images</p>
                </div>
                <button
                  onClick={() => { setShowUploadDoc(false); setDocTitle(''); setDocFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              <form onSubmit={handleUploadDocument} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Document Title</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="Enter document title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">File</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    required
                    accept=".pdf,.doc,.docx,.md,.txt,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={handleFileChange}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl py-2.5 px-4 text-sm text-slate-300 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-500 file:text-white hover:file:bg-amber-400 file:transition-colors cursor-pointer"
                  />
                  <p className="text-xs text-slate-500 mt-1">Max size: 10MB</p>
                </div>
                {docFile && (
                  <div className="p-3 bg-slate-700/50 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-600 flex items-center justify-center">
                      {getFileIcon(docFile.name.split('.').pop() || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{docFile.name}</p>
                      <p className="text-xs text-slate-400">{formatFileSize(docFile.size)}</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowUploadDoc(false); setDocTitle(''); setDocFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!docFile || !docTitle.trim() || isUploading}
                    className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Uploading...
                      </>
                    ) : (
                      'Upload'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {
        showEditProject && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
                <div>
                  <h3 className="text-lg font-bold text-white">Edit Project</h3>
                  <p className="text-xs text-slate-400">Update project details</p>
                </div>
                <button
                  onClick={() => setShowEditProject(false)}
                  className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              <form onSubmit={handleEditProject} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Project Name</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                  <textarea
                    rows={3}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl py-2.5 px-4 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">GitHub Repository</label>
                  <input
                    type="url"
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    value={editForm.github_repo}
                    onChange={(e) => setEditForm({ ...editForm, github_repo: e.target.value })}
                    placeholder="https://github.com/username/repo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Status</label>
                  <select
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'active' | 'archived' })}
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditProject(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {
        showRemoveMember && memberToRemove && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Remove Team Member</h3>
                <p className="text-sm text-slate-400 mb-6">
                  Are you sure you want to remove <span className="text-white font-medium">{memberToRemove.name}</span> from this project? They will lose access immediately.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowRemoveMember(false); setMemberToRemove(null); }}
                    disabled={isRemovingMember}
                    className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRemoveMember}
                    disabled={isRemovingMember}
                    className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-400 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isRemovingMember ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Removing...
                      </>
                    ) : (
                      'Remove Member'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        viewingDoc && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 lg:p-10">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-full flex flex-col shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white truncate max-w-xs sm:max-w-md">{viewingDoc.title}</h3>
                    <p className="text-xs text-slate-500 uppercase">{viewingDoc.file.split('.').pop()} Document</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(viewingDoc)}
                    className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Download
                  </button>
                  <button
                    onClick={() => { setViewingDoc(null); setViewingContent(null); }}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-6 bg-slate-950/50 custom-scrollbar">
                {isViewingLoading ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
                    <div className="w-10 h-10 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin"></div>
                    <p>Loading content...</p>
                  </div>
                ) : (
                  <div className="h-full max-w-full">
                    {(() => {
                      const ext = viewingDoc.file.split('.').pop()?.toLowerCase();
                      if (ext === 'md' && viewingContent) {
                        return (
                          <article className="prose prose-invert prose-sky max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{viewingContent}</ReactMarkdown>
                          </article>
                        );
                      }
                      if (ext === 'txt' && viewingContent) {
                        return (
                          <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                            {viewingContent}
                          </pre>
                        );
                      }
                      if (ext === 'docx' && viewingContent) {
                        return (
                          <div
                            className="prose prose-invert prose-sky max-w-none bg-white/5 p-8 rounded-xl border border-white/10"
                            dangerouslySetInnerHTML={{ __html: viewingContent }}
                          />
                        );
                      }
                      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
                        return (
                          <div className="flex items-center justify-center p-4">
                            <div className="relative max-h-full max-w-full aspect-auto">
                              <Image src={getFileUrl(viewingDoc.file)} alt={viewingDoc.title} width={1200} height={800} className="rounded-lg shadow-2xl object-contain h-auto w-auto" unoptimized />
                            </div>
                          </div>
                        );
                      }
                      if (ext === 'pdf') {
                        return (
                          <iframe src={`${getFileUrl(viewingDoc.file)}#toolbar=0`} className="w-full h-full rounded-lg border-none" title={viewingDoc.title} />
                        );
                      }
                      return (
                        <div className="h-full flex flex-col items-center justify-center text-center gap-6 p-10">
                          <div className="w-24 h-24 rounded-3xl bg-slate-800 flex items-center justify-center">
                            <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                          </div>
                          <div>
                            <h4 className="text-xl font-bold text-white mb-2">Preview not available</h4>
                            <p className="text-slate-400 max-w-md mx-auto">This file type ({ext?.toUpperCase()}) cannot be previewed directly in the browser. Please download it to view the content.</p>
                          </div>
                          <button
                            onClick={() => handleDownload(viewingDoc)}
                            className="flex items-center gap-2 px-6 py-3 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-sky-500/20"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            Download Document
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
