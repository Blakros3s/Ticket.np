'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import type { Editor } from '@tiptap/react';
import { extractTitleFromContent, normalizeEditorContent, type WorkspaceDocContent } from '@/lib/workspace-docs';

export interface DocEditorChange {
  title: string;
  content: WorkspaceDocContent;
}

interface SlashCommand {
  id: string;
  label: string;
  keywords: string[];
  run: (editor: Editor) => void;
}

function buildSlashCommands(): SlashCommand[] {
  return [
    {
      id: 'h1',
      label: 'Heading 1',
      keywords: ['h1', 'heading', 'title'],
      run: (editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
    },
    {
      id: 'h2',
      label: 'Heading 2',
      keywords: ['h2', 'heading', 'subtitle'],
      run: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
    },
    {
      id: 'h3',
      label: 'Heading 3',
      keywords: ['h3', 'heading'],
      run: (editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
    },
    {
      id: 'bullet',
      label: 'Bullet list',
      keywords: ['bullet', 'list', 'ul'],
      run: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: 'ordered',
      label: 'Numbered list',
      keywords: ['numbered', 'ordered', 'list', 'ol'],
      run: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      id: 'code',
      label: 'Code block',
      keywords: ['code', 'snippet'],
      run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: 'quote',
      label: 'Quote',
      keywords: ['quote', 'blockquote'],
      run: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      id: 'divider',
      label: 'Divider',
      keywords: ['divider', 'hr', 'line'],
      run: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
  ];
}

const WorkspaceDocKeyboard = Extension.create({
  name: 'workspaceDocKeyboard',
  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { empty, $from } = this.editor.state.selection;
        if (!empty || !this.editor.isActive('blockquote')) {
          return false;
        }
        if ($from.parent.content.size === 0) {
          return this.editor.chain().focus().lift('blockquote').run();
        }
        return false;
      },
    };
  },
});

function getSlashState(editor: Editor): { query: string; from: number; to: number; top: number; left: number } | null {
  const { $from } = editor.state.selection;
  if (!$from.parent.isTextblock) return null;

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
  const match = textBefore.match(/(?:^|\s)\/(\w*)$/);
  if (!match) return null;

  const slashText = match[0].trimStart();
  const from = $from.pos - slashText.length;
  const coords = editor.view.coordsAtPos($from.pos);

  return {
    query: match[1] ?? '',
    from,
    to: $from.pos,
    top: coords.bottom + window.scrollY + 4,
    left: coords.left + window.scrollX,
  };
}

interface LinkDialogProps {
  isOpen: boolean;
  initialUrl: string;
  onCancel: () => void;
  onSubmit: (url: string) => void;
}

function LinkDialog({ isOpen, initialUrl, onCancel, onSubmit }: LinkDialogProps) {
  const [url, setUrl] = useState(initialUrl);

  useEffect(() => {
    if (isOpen) setUrl(initialUrl);
  }, [isOpen, initialUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <form
        className="relative modal-panel shadow-2xl max-w-md w-full p-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(url.trim());
        }}
      >
        <h3 className="modal-title mb-2">Insert link</h3>
        <p className="page-subtitle mb-4">Paste a URL. Leave empty to remove the link.</p>
        <input
          type="url"
          className="input-field w-full mb-6"
          placeholder="https://example.com"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          autoFocus
        />
        <div className="flex gap-3 justify-end">
          <button type="button" className="btn-secondary px-4 py-2 rounded-lg" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary px-4 py-2 rounded-lg font-medium">
            Apply
          </button>
        </div>
      </form>
    </div>
  );
}

function BubbleToolbar({
  editor,
  onLink,
}: {
  editor: Editor;
  onLink: () => void;
}) {
  return (
    <div className="workspace-doc-bubble">
      <button type="button" className={`workspace-doc-bubble__btn ${editor.isActive('bold') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
      <button type="button" className={`workspace-doc-bubble__btn ${editor.isActive('italic') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
      <button type="button" className={`workspace-doc-bubble__btn ${editor.isActive('underline') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleUnderline().run()}>U</button>
      <button type="button" className={`workspace-doc-bubble__btn ${editor.isActive('strike') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleStrike().run()}>S</button>
      <button type="button" className={`workspace-doc-bubble__btn ${editor.isActive('code') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleCode().run()}>Code</button>
      <button type="button" className={`workspace-doc-bubble__btn ${editor.isActive('link') ? 'is-active' : ''}`} onClick={onLink}>Link</button>
    </div>
  );
}

function SlashMenu({
  state,
  commands,
  onSelect,
  onDismiss,
}: {
  state: { query: string; from: number; to: number; top: number; left: number };
  commands: SlashCommand[];
  onSelect: (command: SlashCommand) => void;
  onDismiss: () => void;
}) {
  const filtered = commands.filter((command) => {
    const q = state.query.toLowerCase();
    if (!q) return true;
    return (
      command.label.toLowerCase().includes(q)
      || command.keywords.some((keyword) => keyword.includes(q))
    );
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    setActiveIndex(0);
  }, [state.query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (filtered.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) => (index + 1) % filtered.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        onSelect(filtered[activeIndexRef.current]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [filtered, onDismiss, onSelect]);

  if (filtered.length === 0) return null;

  return (
    <div
      className="workspace-doc-slash-menu"
      style={{ top: state.top, left: state.left }}
      role="listbox"
    >
      {filtered.map((command, index) => (
        <button
          key={command.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={`workspace-doc-slash-menu__item ${index === activeIndex ? 'is-active' : ''}`}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(command);
          }}
        >
          {command.label}
        </button>
      ))}
    </div>
  );
}

interface WorkspaceDocEditorProps {
  defaultContent: WorkspaceDocContent;
  titleFallback?: string;
  onChange: (payload: DocEditorChange) => void;
  readOnly?: boolean;
}

export function WorkspaceDocEditor({
  defaultContent,
  titleFallback = 'Untitled',
  onChange,
  readOnly = false,
}: WorkspaceDocEditorProps) {
  const slashCommands = useMemo(() => buildSlashCommands(), []);
  const [slashState, setSlashState] = useState<ReturnType<typeof getSlashState>>(null);
  const slashStateRef = useRef(slashState);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkInitialUrl, setLinkInitialUrl] = useState('https://');

  useEffect(() => {
    slashStateRef.current = slashState;
  }, [slashState]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: {},
      }),
      WorkspaceDocKeyboard,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'workspace-doc-link', rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading' && node.attrs.level === 1) {
            return 'Untitled';
          }
          return 'Type / for blocks, or start writing…';
        },
        showOnlyWhenEditable: true,
        includeChildren: false,
      }),
    ],
    content: normalizeEditorContent(defaultContent, titleFallback),
    editorProps: {
      attributes: {
        class: 'workspace-doc-prose',
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      const content = activeEditor.getJSON() as WorkspaceDocContent;
      onChange({
        title: extractTitleFromContent(content),
        content,
      });
      setSlashState(getSlashState(activeEditor));
    },
    onSelectionUpdate: ({ editor: activeEditor }) => {
      setSlashState(getSlashState(activeEditor));
    },
  });

  const runSlashCommand = useCallback((command: SlashCommand) => {
    const state = slashStateRef.current;
    if (!editor || !state) return;
    editor.chain().focus().deleteRange({ from: state.from, to: state.to }).run();
    command.run(editor);
    setSlashState(null);
  }, [editor]);

  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    setLinkInitialUrl(previous || 'https://');
    setLinkDialogOpen(true);
  }, [editor]);

  const applyLink = useCallback((url: string) => {
    if (!editor) return;
    setLinkDialogOpen(false);
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }, [editor]);

  const insertSlashTrigger = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent('/').run();
  }, [editor]);

  return (
    <div className="workspace-doc-editor">
      {!readOnly && editor && (
        <>
          <LinkDialog
            isOpen={linkDialogOpen}
            initialUrl={linkInitialUrl}
            onCancel={() => setLinkDialogOpen(false)}
            onSubmit={applyLink}
          />
          <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 100, placement: 'top' }}
            shouldShow={({ editor: activeEditor, state }) => {
              const { from, to } = state.selection;
              if (from === to) return false;
              if (activeEditor.isActive('codeBlock')) return false;
              return true;
            }}
          >
            <BubbleToolbar editor={editor} onLink={openLinkDialog} />
          </BubbleMenu>
          <FloatingMenu
            editor={editor}
            tippyOptions={{ duration: 100, placement: 'left', offset: [-8, 0] }}
            shouldShow={({ editor: activeEditor }) => {
              const { $from } = activeEditor.state.selection;
              if (activeEditor.isActive('heading', { level: 1 })) return false;
              if (activeEditor.isActive('bulletList') || activeEditor.isActive('orderedList')) return false;
              if (activeEditor.isActive('blockquote') || activeEditor.isActive('codeBlock')) return false;
              if ($from.parent.type.name !== 'paragraph' || $from.depth !== 1) return false;
              return $from.parent.content.size === 0;
            }}
          >
            <button type="button" className="workspace-doc-plus-btn" onClick={insertSlashTrigger} aria-label="Insert block">
              +
            </button>
          </FloatingMenu>
          {slashState && (
            <SlashMenu
              state={slashState}
              commands={slashCommands}
              onSelect={runSlashCommand}
              onDismiss={() => setSlashState(null)}
            />
          )}
        </>
      )}
      <EditorContent editor={editor} className="workspace-doc-editor__content" />
    </div>
  );
}
