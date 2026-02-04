'use client';

import { useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Dialog */}
      <div className="relative bg-slate-800 rounded-xl border border-slate-700/50 shadow-2xl max-w-md w-full p-6 transform transition-all">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
          isDestructive ? 'bg-red-500/20' : 'bg-amber-500/20'
        }`}>
          <svg 
            className={`w-6 h-6 ${isDestructive ? 'text-red-400' : 'text-amber-400'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            {isDestructive ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            )}
          </svg>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        
        {/* Message */}
        <p className="text-slate-400 mb-6">{message}</p>

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isDestructive 
                ? 'bg-red-500 text-white hover:bg-red-600' 
                : 'bg-sky-500 text-white hover:bg-sky-600'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
