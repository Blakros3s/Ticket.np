'use client';

import { useState, useCallback, DragEvent, ClipboardEvent } from 'react';

interface UseFileUploadOptions {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
}

export function useFileUpload({ onFilesSelected, multiple = false }: UseFileUploadOptions) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      if (multiple) {
        onFilesSelected(droppedFiles);
      } else {
        onFilesSelected([droppedFiles[0]]);
      }
    }
  }, [multiple, onFilesSelected]);

  const handlePaste = useCallback((e: ClipboardEvent | globalThis.ClipboardEvent) => {
    const items = (e as any).clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      if (multiple) {
        onFilesSelected(files);
      } else {
        onFilesSelected([files[0]]);
      }
    }
  }, [multiple, onFilesSelected]);

  return {
    isDragging,
    dragProps: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
    handlePaste,
  };
}
