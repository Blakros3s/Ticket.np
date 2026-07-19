from __future__ import annotations

import re
from urllib.parse import urlparse

_GITHUB_REPO_RE = re.compile(
    r'^https?://(?:www\.)?github\.com/(?P<owner>[\w.\-]+)/(?P<repo>[\w.\-]+?)(?:\.git)?/?$',
    re.IGNORECASE,
)


def parse_github_repo_url(url: str | None) -> tuple[str, str] | None:
    if not url:
        return None
    text = url.strip()
    match = _GITHUB_REPO_RE.match(text)
    if match:
        return match.group('owner'), match.group('repo')
    parsed = urlparse(text)
    if parsed.netloc.lower().endswith('github.com'):
        parts = [part for part in parsed.path.strip('/').split('/') if part]
        if len(parts) >= 2:
            return parts[0], parts[1].removesuffix('.git')
    return None


def github_issue_labels(ticket_type: str) -> list[str]:
    mapping = {
        'bug': 'bug',
        'task': 'task',
        'feature': 'enhancement',
    }
    label = mapping.get(ticket_type)
    return [label] if label else []
