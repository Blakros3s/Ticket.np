'use client';

export function WorkspaceDocRenderer({ contentHtml, title }: { contentHtml?: string; title: string }) {
  if (!contentHtml) return null;

  return (
    <article className="workspace-doc-public">
      <h1 className="workspace-doc-public__title">{title}</h1>
      <div
        className="workspace-doc-public__body workspace-doc-prose workspace-doc-prose--readonly"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    </article>
  );
}
