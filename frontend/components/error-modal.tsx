'use client';

import React from 'react';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  statusCode?: number;
  onRetry?: () => void;
  retryText?: string;
}

export function ErrorModal({
  isOpen,
  onClose,
  title = 'Error',
  message,
  statusCode,
  onRetry,
  retryText = 'Try Again'
}: ErrorModalProps) {
  if (!isOpen) return null;

  const getStatusColor = (code: number) => {
    if (code >= 500) return 'bg-red-500/20 text-red-400';
    if (code === 401 || code === 403) return 'bg-orange-500/20 text-orange-400';
    if (code === 404) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-blue-500/20 text-blue-400';
  };

  const getStatusLabel = (code: number) => {
    if (code >= 500) return `${code} Server Error`;
    if (code === 401) return `${code} Unauthorized`;
    if (code === 403) return `${code} Forbidden`;
    if (code === 404) return `${code} Not Found`;
    if (code === 400) return `${code} Bad Request`;
    return `${code} Error`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      
      {/* Modal Content */}
      <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl transform transition-all animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        
        {/* Error Message */}
        <div className="mb-6">
          <p className="text-slate-300 text-base leading-relaxed">
            {message}
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors"
          >
            Close
          </button>
          {onRetry && (
            <button
              onClick={() => {
                onClose();
                onRetry();
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 hover:from-sky-600 hover:to-violet-600 text-white font-semibold transition-all shadow-lg shadow-sky-500/25"
            >
              {retryText}
            </button>
          )}
        </div>
        
        {/* Status Code Badge */}
        {statusCode && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Status</span>
              <span className={`px-2 py-1 rounded font-mono text-xs ${getStatusColor(statusCode)}`}>
                {getStatusLabel(statusCode)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to extract error messages from API responses
export function extractErrorMessage(error: any): { message: string; statusCode?: number } {
  let message = 'An unexpected error occurred. Please try again.';
  let statusCode: number | undefined;

  if (error?.response) {
    statusCode = error.response.status;
    const data = error.response.data;

    // Check for {detail: "message"} format
    if (data?.detail) {
      message = data.detail;
    }
    // Check for {non_field_errors: ["message"]} format
    else if (data?.non_field_errors && Array.isArray(data.non_field_errors)) {
      message = data.non_field_errors[0];
    }
    // Check for field-specific errors {username: ["message"]}
    else if (data && typeof data === 'object') {
      const fieldErrors = Object.entries(data)
        .filter(([key]) => key !== 'detail' && key !== 'non_field_errors')
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return `${key}: ${value[0]}`;
          }
          return `${key}: ${value}`;
        });
      
      if (fieldErrors.length > 0) {
        message = fieldErrors[0];
      }
    }
    // If data is a string, return it directly
    else if (typeof data === 'string') {
      message = data;
    }

    // HTTP status specific messages
    if (statusCode === 401) {
      message = message || 'Invalid credentials. Please check your username and password.';
    } else if (statusCode === 403) {
      message = message || 'You do not have permission to perform this action.';
    } else if (statusCode === 404) {
      message = message || 'The requested resource was not found.';
    } else if (statusCode === 500) {
      message = message || 'Server error. Please try again later.';
    } else if (statusCode === 0 || !statusCode) {
      message = 'Network error. Please check your internet connection.';
    }
  } else if (error?.request) {
    // Request was made but no response
    message = 'Network error. Please check your internet connection.';
  } else if (error?.message) {
    // Something else happened
    message = error.message;
  }

  return { message, statusCode };
}
