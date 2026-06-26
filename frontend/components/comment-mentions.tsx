'use client';

import React from 'react';

const MENTION_PATTERN = /@([a-zA-Z0-9_]+)/g;

export function renderCommentContent(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  MENTION_PATTERN.lastIndex = 0;
  while ((match = MENTION_PATTERN.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={`${match.index}-${match[1]}`}
        className="text-sky-400 font-medium bg-sky-500/10 px-1 rounded"
      >
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [content];
}

interface MentionableUser {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
}

interface CommentMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  mentionableUsers: MentionableUser[];
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

function displayName(user: MentionableUser): string {
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return full || user.username;
}

export function CommentMentionInput({
  value,
  onChange,
  mentionableUsers,
  placeholder = 'Write a comment... Type @ to mention someone',
  rows = 3,
  disabled = false,
}: CommentMentionInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [mentionStart, setMentionStart] = React.useState(-1);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const suggestions = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase();
    return mentionableUsers
      .filter((user) => displayName(user).toLowerCase().includes(query) || user.username.toLowerCase().includes(query))
      .slice(0, 8);
  }, [mentionQuery, mentionableUsers]);

  const closeMentions = () => {
    setMentionQuery(null);
    setMentionStart(-1);
    setActiveIndex(0);
  };

  const detectMention = (text: string, cursor: number) => {
    const before = text.slice(0, cursor);
    const atIndex = before.lastIndexOf('@');
    if (atIndex === -1) {
      closeMentions();
      return;
    }

    const charBefore = atIndex > 0 ? before[atIndex - 1] : ' ';
    if (charBefore && !/\s/.test(charBefore)) {
      closeMentions();
      return;
    }

    const query = before.slice(atIndex + 1);
    if (/\s/.test(query)) {
      closeMentions();
      return;
    }

    setMentionStart(atIndex);
    setMentionQuery(query);
    setActiveIndex(0);
  };

  const insertMention = (username: string) => {
    const textarea = textareaRef.current;
    if (!textarea || mentionStart < 0) return;

    const cursor = textarea.selectionStart;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const mentionText = `@${username} `;
    const nextValue = `${before}${mentionText}${after}`;
    onChange(nextValue);
    closeMentions();

    requestAnimationFrame(() => {
      const nextCursor = before.length + mentionText.length;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    onChange(nextValue);
    detectMention(nextValue, e.target.selectionStart);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery === null || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(suggestions[activeIndex].username);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMentions();
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        rows={rows}
        className="input-field w-full resize-none"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(e) => detectMention(value, e.currentTarget.selectionStart)}
        disabled={disabled}
      />

      {mentionQuery !== null && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-600 bg-slate-800 shadow-xl">
          {suggestions.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(user.username);
              }}
              className={`w-full px-3 py-2 text-left transition-colors ${
                index === activeIndex
                  ? 'bg-sky-500/20 text-white'
                  : 'text-slate-200 hover:bg-slate-700/60'
              }`}
            >
              <span className="text-sm font-medium">{displayName(user)}</span>
              <span className="ml-2 text-xs text-slate-400">@{user.username}</span>
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500 mt-1">
        Type <span className="text-sky-400">@</span> followed by a name to mention someone
      </p>
    </div>
  );
}
