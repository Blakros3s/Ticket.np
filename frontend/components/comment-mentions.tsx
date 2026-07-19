'use client';

import React from 'react';

interface MentionableUser {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
}

function displayName(user: MentionableUser): string {
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return full || user.username;
}

function isMentionBoundary(content: string, index: number): boolean {
  return index >= content.length || /[\s.,!?;:]/.test(content[index]);
}

function findMentionSpans(
  content: string,
  users: MentionableUser[],
): Array<{ start: number; end: number }> {
  if (!content) return [];

  const names = users
    .map((user) => displayName(user))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const spans: Array<{ start: number; end: number }> = [];
  let index = 0;

  while (index < content.length) {
    if (content[index] !== '@') {
      index += 1;
      continue;
    }

    const rest = content.slice(index + 1);
    let matched = false;

    for (const name of names) {
      if (!rest.toLowerCase().startsWith(name.toLowerCase())) continue;
      if (!isMentionBoundary(rest, name.length)) continue;
      spans.push({ start: index, end: index + 1 + name.length });
      index += 1 + name.length;
      matched = true;
      break;
    }

    if (matched) continue;

    const usernameMatch = rest.match(/^([a-zA-Z0-9_]+)/);
    if (usernameMatch && isMentionBoundary(rest, usernameMatch[1].length)) {
      spans.push({ start: index, end: index + 1 + usernameMatch[1].length });
      index += 1 + usernameMatch[1].length;
      continue;
    }

    index += 1;
  }

  return spans;
}

export function renderCommentContent(
  content: string,
  users: MentionableUser[] = [],
): React.ReactNode[] {
  const spans = findMentionSpans(content, users);
  if (spans.length === 0) return [content];

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  spans.forEach((span, spanIndex) => {
    if (span.start > lastIndex) {
      parts.push(content.slice(lastIndex, span.start));
    }
    const mentionText = content.slice(span.start, span.end);
    parts.push(
      <span
        key={`mention-${span.start}-${spanIndex}`}
        className="mention-highlight"
      >
        {mentionText}
      </span>,
    );
    lastIndex = span.end;
  });

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

interface CommentMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  mentionableUsers: MentionableUser[];
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
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
      .filter((user) => displayName(user).toLowerCase().includes(query))
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

  const insertMention = (user: MentionableUser) => {
    const textarea = textareaRef.current;
    if (!textarea || mentionStart < 0) return;

    const cursor = textarea.selectionStart;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const name = displayName(user);
    const mentionText = `@${name} `;
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
      insertMention(suggestions[activeIndex]);
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
        <div className="mention-dropdown">
          {suggestions.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(user);
              }}
              className={`mention-dropdown-item ${
                index === activeIndex ? 'mention-dropdown-item--active' : ''
              }`}
            >
              <span className="text-sm font-medium">{displayName(user)}</span>
            </button>
          ))}
        </div>
      )}

      <p className="meta-text text-xs mt-1">
        Type <span style={{ color: 'var(--accent)' }}>@</span> followed by a name to mention someone
      </p>
    </div>
  );
}
