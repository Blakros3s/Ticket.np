import html
import re

_HEADING_RE = re.compile(r'^(#{1,6})\s+(.*)$', re.MULTILINE)


def render_doc_content_html(content: dict, *, skip_title_heading: bool = False) -> str:
    """Render Tiptap/ProseMirror JSON blocks to sanitized HTML for public share pages."""
    if not content or not isinstance(content, dict):
        return ''

    blocks = content.get('content') or []
    if skip_title_heading and blocks:
        first = blocks[0]
        if isinstance(first, dict) and first.get('type') == 'heading' and first.get('attrs', {}).get('level') == 1:
            blocks = blocks[1:]

    parts: list[str] = []

    for block in blocks:
        if not isinstance(block, dict):
            continue
        block_type = block.get('type')
        if block_type == 'heading':
            level = block.get('attrs', {}).get('level', 2)
            level = min(max(int(level), 1), 6)
            parts.append(f'<h{level}>{_inline_text(block)}</h{level}>')
        elif block_type == 'paragraph':
            inner = _inline_text(block)
            parts.append(f'<p>{inner or "<br>"}</p>')
        elif block_type in ('bulletList', 'orderedList'):
            rendered = _render_list(block)
            if rendered:
                parts.append(rendered)
        elif block_type == 'blockquote':
            inner = block.get('content') or []
            inner_html = render_doc_content_html({'type': 'doc', 'content': inner})
            if inner_html:
                parts.append(f'<blockquote>{inner_html}</blockquote>')
        elif block_type == 'codeBlock':
            text = ''.join(
                html.escape(child.get('text', ''))
                for child in (block.get('content') or [])
                if child.get('type') == 'text'
            )
            parts.append(f'<pre><code>{text}</code></pre>')
        elif block_type == 'horizontalRule':
            parts.append('<hr>')

    return '\n'.join(parts)


def _render_list(block: dict) -> str:
    tag = 'ul' if block.get('type') == 'bulletList' else 'ol'
    items = block.get('content') or []
    lis: list[str] = []
    for item in items:
        if item.get('type') != 'listItem':
            continue
        body = _render_list_item_content(item)
        if body:
            lis.append(f'<li>{body}</li>')
    return f'<{tag}>{"".join(lis)}</{tag}>' if lis else ''


def _render_list_item_content(item: dict) -> str:
    parts: list[str] = []
    for child in item.get('content') or []:
        child_type = child.get('type')
        if child_type == 'paragraph':
            parts.append(_inline_text(child) or '<br>')
        elif child_type in ('bulletList', 'orderedList'):
            parts.append(_render_list(child))
        elif child_type == 'blockquote':
            inner_html = render_doc_content_html({'type': 'doc', 'content': child.get('content') or []})
            if inner_html:
                parts.append(f'<blockquote>{inner_html}</blockquote>')
    return ''.join(parts)


def _apply_marks(text: str, marks: list) -> str:
    escaped = html.escape(text)
    for mark in marks:
        mark_type = mark.get('type')
        if mark_type == 'bold':
            escaped = f'<strong>{escaped}</strong>'
        elif mark_type == 'italic':
            escaped = f'<em>{escaped}</em>'
        elif mark_type == 'underline':
            escaped = f'<u>{escaped}</u>'
        elif mark_type == 'strike':
            escaped = f'<s>{escaped}</s>'
        elif mark_type == 'code':
            escaped = f'<code>{escaped}</code>'
        elif mark_type == 'link':
            href = mark.get('attrs', {}).get('href', '').strip()
            if href.lower().startswith(('http://', 'https://', 'mailto:')):
                safe_href = html.escape(href, quote=True)
                escaped = f'<a href="{safe_href}" rel="noopener noreferrer">{escaped}</a>'
    return escaped


def _inline_text(node: dict) -> str:
    if not node:
        return ''
    pieces: list[str] = []
    for child in node.get('content') or []:
        if child.get('type') == 'text':
            text = child.get('text', '')
            marks = child.get('marks') or []
            pieces.append(_apply_marks(text, marks))
        elif child.get('type') == 'hardBreak':
            pieces.append('<br>')
    return ''.join(pieces)
