'use client';

import React, { useRef, useEffect } from 'react';
import { useFileUpload } from '@/hooks/use-file-upload';

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  placeholder?: string;
  description?: string;
  className?: string;
  icon?: React.ReactNode;
}

export function FileUploadZone({
  onFilesSelected,
  multiple = false,
  accept,
  placeholder = 'Click to upload files or drag and drop',
  description = 'Images, videos, PDF, documents',
  className = '',
  icon
}: FileUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { isDragging, dragProps, handlePaste } = useFileUpload({
    onFilesSelected,
    multiple
  });

  // Attach global paste listener when the component is focused or just generally for this view
  useEffect(() => {
    const pasteHandler = (e: globalThis.ClipboardEvent) => {
      // Only handle paste if we're not typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      
      handlePaste(e);
    };

    window.addEventListener('paste', pasteHandler);
    return () => window.removeEventListener('paste', pasteHandler);
  }, [handlePaste]);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      {...dragProps}
      onClick={() => fileInputRef.current?.click()}
      className={`
        relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
        ${isDragging 
          ? 'border-sky-500 bg-sky-500/5 ring-4 ring-sky-500/10' 
          : 'border-slate-700 hover:border-sky-500/50 hover:bg-slate-800/50'}
        ${className}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={onFileInputChange}
        className="hidden"
      />
      
      <div className={`transition-transform duration-200 ${isDragging ? 'scale-110' : 'scale-100'}`}>
        {icon || (
          <svg className={`w-10 h-10 mx-auto mb-2 transition-colors ${isDragging ? 'text-sky-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        )}
        <p className={`text-sm font-medium transition-colors ${isDragging ? 'text-sky-400' : 'text-slate-400'}`}>
          {isDragging ? 'Drop files here' : placeholder}
        </p>
        {description && (
          <p className="text-slate-500 text-xs mt-1">{description}</p>
        )}
      </div>

      {/* Subtle "Paste" indicator */}
      <div className="mt-4 flex items-center justify-center gap-2 opacity-40">
        <kbd className="px-1.5 py-0.5 text-[10px] font-sans font-semibold text-slate-400 bg-slate-800 border border-slate-700 rounded-md">Ctrl</kbd>
        <span className="text-[10px] text-slate-500">+</span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-sans font-semibold text-slate-400 bg-slate-800 border border-slate-700 rounded-md">V</kbd>
        <span className="text-[10px] text-slate-500">to paste image</span>
      </div>
    </div>
  );
}
