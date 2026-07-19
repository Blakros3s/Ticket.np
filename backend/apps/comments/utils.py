import re

from apps.notifications.models import Notification
from apps.users.models import User

USERNAME_MENTION_PATTERN = re.compile(r'@([a-zA-Z0-9_]+)')


def _mention_boundary(content: str, index: int) -> bool:
    return index >= len(content) or content[index] in ' \n\t.,!?;:'


def parse_mentioned_users(content: str, project) -> list[User]:
    """Resolve @mentions by full name (preferred) or username (legacy)."""
    if not content:
        return []

    members = list(
        User.objects.filter(
            projects=project,
            is_active=True,
        ).distinct()
    )
    if not members:
        return []

    by_full_name: dict[str, User] = {}
    by_username: dict[str, User] = {}
    for member in members:
        full_name = (member.get_full_name() or '').strip()
        if full_name:
            by_full_name[full_name.lower()] = member
        by_username[member.username.lower()] = member

    matched: dict[int, User] = {}
    index = 0
    while index < len(content):
        if content[index] != '@':
            index += 1
            continue

        rest = content[index + 1 :]
        found = False

        for name in sorted(by_full_name.keys(), key=len, reverse=True):
            if not rest.lower().startswith(name):
                continue
            if not _mention_boundary(rest, len(name)):
                continue
            matched[by_full_name[name].id] = by_full_name[name]
            index += 1 + len(name)
            found = True
            break

        if found:
            continue

        username_match = USERNAME_MENTION_PATTERN.match(rest)
        if username_match and _mention_boundary(rest, username_match.end()):
            username = username_match.group(1).lower()
            if username in by_username:
                matched[by_username[username].id] = by_username[username]
            index += 1 + username_match.end()
            continue

        index += 1

    return list(matched.values())


def parse_mentioned_usernames(content: str) -> set[str]:
    """Legacy helper — returns raw @tokens (usernames only)."""
    return set(USERNAME_MENTION_PATTERN.findall(content or ''))


def notify_comment_mentions(author, ticket, content: str) -> None:
    """Notify project members mentioned in a ticket comment."""
    mentioned_users = parse_mentioned_users(content, ticket.project)
    if not mentioned_users:
        return

    for user in mentioned_users:
        if user.pk == author.pk:
            continue
        try:
            Notification.objects.create(
                user=user,
                message=(
                    f'{author.get_full_name() or author.username} mentioned you in a comment on '
                    f'{ticket.ticket_id}: {ticket.title}'
                ),
                ticket_id=ticket.id,
                ticket_title=ticket.title[:255],
            )
        except Exception:
            pass
