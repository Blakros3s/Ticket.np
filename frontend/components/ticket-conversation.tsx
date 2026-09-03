'use client';

import Image from 'next/image';
import { ChangeEvent, RefObject, useEffect, useMemo, useState } from 'react';
import { CommentMentionInput, renderCommentContent } from '@/components/comment-mentions';
import { FileUploadZone } from '@/components/file-upload-zone';
import { User } from '@/lib/auth';
import {
  buildConversationTimeline,
  ConversationTimelineItem,
  fetchMediaBlobUrl,
  isImageMedia,
  resolveMediaUrl,
  Ticket,
  TicketMedia,
} from '@/lib/tickets';

interface MentionableUser {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
}

interface TicketConversationProps {
  ticket: Ticket;
  users: User[];
  mentionableUsers: MentionableUser[];
  canEdit: boolean;
  canUploadAttachments: boolean;
  uploadingMedia: boolean;
  newComment: string;
  onNewCommentChange: (value: string) => void;
  commentImages: File[];
  onCommentImageSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveCommentImage: (index: number) => void;
  submittingComment: boolean;
  onAddComment: () => void;
  onUploadTicketMedia: (files: File[]) => Promise<void>;
  onViewMedia: (media: TicketMedia) => void;
  onOpenAttachment: (media: TicketMedia) => void;
  onDeleteMedia: (mediaId: number) => void;
  commentFileInputRef: RefObject<HTMLInputElement | null>;
  formatDateTime: (date: string | null) => string;
  formatFileSize: (bytes: number) => string;
}

function userInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U';
}

function TimelineAvatar({ name }: { name: string }) {
  return (
    <div className="ticket-timeline-avatar" aria-hidden="true">
      {userInitials(name)}
    </div>
  );
}

interface ConversationMediaProps {
  media: TicketMedia;
  onView: (media: TicketMedia) => void;
  onOpen: (media: TicketMedia) => void;
  onDelete?: (mediaId: number) => void;
  canDelete?: boolean;
  formatFileSize: (bytes: number) => string;
  variant?: 'inline' | 'grid';
}

function ConversationMedia({
  media,
  onView,
  onOpen,
  onDelete,
  canDelete = false,
  formatFileSize,
  variant = 'inline',
}: ConversationMediaProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        objectUrl = await fetchMediaBlobUrl(media.file);
        if (!cancelled) setSrc(objectUrl);
      } catch {
        if (!cancelled) setSrc(resolveMediaUrl(media.file));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [media.file, media.id]);

  if (isImageMedia(media)) {
    return (
      <div className={`ticket-timeline-media ${variant === 'grid' ? 'ticket-timeline-media--grid' : ''}`}>
        <button
          type="button"
          onClick={() => onView(media)}
          className="ticket-timeline-media-image"
          aria-label={`View ${media.file_name}`}
        >
          {loading ? (
            <div className="ticket-timeline-media-skeleton" />
          ) : (
            <img src={src || undefined} alt={media.file_name} className="h-full w-full object-cover" />
          )}
        </button>
        {canDelete && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(media.id)}
            className="ticket-timeline-media-delete"
          >
            Remove
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="ticket-timeline-file">
      <button type="button" onClick={() => onOpen(media)} className="ticket-timeline-file-button">
        <span className="ticket-timeline-file-icon" aria-hidden="true">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm text-white">{media.file_name}</span>
          <span className="meta-text text-xs">{formatFileSize(media.file_size)}</span>
        </span>
      </button>
      {canDelete && onDelete && (
        <button
          type="button"
          onClick={() => onDelete(media.id)}
          className="ticket-timeline-file-delete"
        >
          Remove
        </button>
      )}
    </div>
  );
}

function CommentTimelineItem({
  comment,
  users,
  formatDateTime,
  formatFileSize,
  onViewMedia,
  onOpenAttachment,
}: {
  comment: NonNullable<Ticket['comments']>[number];
  users: User[];
  formatDateTime: (date: string | null) => string;
  formatFileSize: (bytes: number) => string;
  onViewMedia: (media: TicketMedia) => void;
  onOpenAttachment: (media: TicketMedia) => void;
}) {
  const edited = comment.updated_at !== comment.created_at;

  return (
    <article className="ticket-timeline-card">
      <header className="ticket-timeline-card-header">
        <div className="min-w-0">
          <span className="ticket-timeline-author">{comment.user_name}</span>
          <span className="ticket-timeline-meta">
            commented {formatDateTime(comment.created_at)}
            {edited ? ' (edited)' : ''}
          </span>
        </div>
      </header>
      <div className="ticket-timeline-card-body">
        {comment.content ? (
          <div className="ticket-timeline-comment-text">
            {renderCommentContent(comment.content, users)}
          </div>
        ) : null}
        {comment.media_files && comment.media_files.length > 0 && (
          <div className="ticket-timeline-media-grid">
            {comment.media_files.map((media) => (
              <ConversationMedia
                key={media.id}
                media={media}
                onView={onViewMedia}
                onOpen={onOpenAttachment}
                formatFileSize={formatFileSize}
                variant="grid"
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function AttachmentTimelineItem({
  media,
  formatDateTime,
  formatFileSize,
  onViewMedia,
  onOpenAttachment,
  onDeleteMedia,
  canDelete,
}: {
  media: TicketMedia;
  formatDateTime: (date: string | null) => string;
  formatFileSize: (bytes: number) => string;
  onViewMedia: (media: TicketMedia) => void;
  onOpenAttachment: (media: TicketMedia) => void;
  onDeleteMedia: (mediaId: number) => void;
  canDelete: boolean;
}) {
  return (
    <article className="ticket-timeline-card">
      <header className="ticket-timeline-card-header">
        <div className="min-w-0">
          <span className="ticket-timeline-author">{media.uploaded_by_username}</span>
          <span className="ticket-timeline-meta">
            attached a file {formatDateTime(media.created_at)}
          </span>
        </div>
      </header>
      <div className="ticket-timeline-card-body">
        <ConversationMedia
          media={media}
          onView={onViewMedia}
          onOpen={onOpenAttachment}
          onDelete={onDeleteMedia}
          canDelete={canDelete}
          formatFileSize={formatFileSize}
          variant="grid"
        />
      </div>
    </article>
  );
}

function renderTimelineItem(
  item: ConversationTimelineItem,
  props: Omit<TicketConversationProps, 'ticket' | 'newComment' | 'onNewCommentChange' | 'commentImages' | 'onCommentImageSelect' | 'onRemoveCommentImage' | 'submittingComment' | 'onAddComment' | 'onUploadTicketMedia' | 'commentFileInputRef' | 'uploadingMedia' | 'canUploadAttachments' | 'mentionableUsers'>,
) {
  if (item.kind === 'comment') {
    return (
      <CommentTimelineItem
        key={item.key}
        comment={item.comment}
        users={props.users}
        formatDateTime={props.formatDateTime}
        formatFileSize={props.formatFileSize}
        onViewMedia={props.onViewMedia}
        onOpenAttachment={props.onOpenAttachment}
      />
    );
  }

  return (
    <AttachmentTimelineItem
      key={item.key}
      media={item.media}
      formatDateTime={props.formatDateTime}
      formatFileSize={props.formatFileSize}
      onViewMedia={props.onViewMedia}
      onOpenAttachment={props.onOpenAttachment}
      onDeleteMedia={props.onDeleteMedia}
      canDelete={props.canEdit}
    />
  );
}

export function TicketConversation({
  ticket,
  users,
  mentionableUsers,
  canEdit,
  canUploadAttachments,
  uploadingMedia,
  newComment,
  onNewCommentChange,
  commentImages,
  onCommentImageSelect,
  onRemoveCommentImage,
  submittingComment,
  onAddComment,
  onUploadTicketMedia,
  onViewMedia,
  onOpenAttachment,
  onDeleteMedia,
  commentFileInputRef,
  formatDateTime,
  formatFileSize,
}: TicketConversationProps) {
  const timelineItems = useMemo(() => buildConversationTimeline(ticket), [ticket]);
  const commentCount = ticket.comments?.length ?? 0;
  const attachmentCount = ticket.media_files?.length ?? 0;

  const sharedItemProps = {
    users,
    canEdit,
    formatDateTime,
    formatFileSize,
    onViewMedia,
    onOpenAttachment,
    onDeleteMedia,
  };

  return (
    <section className="form-card p-0 overflow-hidden">
      <div className="border-b border-slate-700/50 px-6 py-4">
        <h3 className="surface-panel-title">Conversation</h3>
        <p className="page-subtitle mt-1">
          {commentCount} comment{commentCount === 1 ? '' : 's'}
          {attachmentCount > 0 ? ` · ${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}` : ''}
        </p>
      </div>

      <div className="px-6 py-6">
        {timelineItems.length > 0 ? (
          <div className="ticket-timeline">
            {timelineItems.map((item) => {
              const actorName =
                item.kind === 'comment' ? item.comment.user_name : item.media.uploaded_by_username;

              return (
                <div key={item.key} className="ticket-timeline-item">
                  <TimelineAvatar name={actorName} />
                  <div className="ticket-timeline-content">
                    {renderTimelineItem(item, sharedItemProps)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ticket-timeline-empty">
            <p className="text-sm text-slate-400">No comments or attachments yet.</p>
            <p className="meta-text mt-1">Start the discussion below.</p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-700/50 bg-slate-900/20 px-6 py-5">
        <div className="ticket-timeline-composer">
          <CommentMentionInput
            value={newComment}
            onChange={onNewCommentChange}
            mentionableUsers={mentionableUsers}
            disabled={submittingComment}
          />

          <input
            ref={commentFileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onCommentImageSelect}
          />

          {commentImages.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {commentImages.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative">
                  <Image
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    width={96}
                    height={96}
                    className="h-24 w-24 rounded-lg border border-slate-600 object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveCommentImage(index)}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {canUploadAttachments && (
            <div className="mt-4">
              {uploadingMedia && (
                <p className="meta-text mb-2 text-xs">Uploading attachments…</p>
              )}
              <FileUploadZone
                onFilesSelected={onUploadTicketMedia}
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.txt,.md,.xls,.xlsx"
                placeholder="Drop ticket attachments here or click to browse"
                className="ticket-timeline-upload bg-slate-800/30"
              />
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => commentFileInputRef.current?.click()}
                disabled={submittingComment}
                className="btn-secondary text-sm"
              >
                Attach images
              </button>
            </div>
            <button
              type="button"
              onClick={onAddComment}
              disabled={submittingComment || (!newComment.trim() && commentImages.length === 0)}
              className="btn-primary px-4 py-2 text-sm"
            >
              {submittingComment ? 'Posting…' : 'Comment'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
