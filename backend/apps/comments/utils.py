import re

from apps.notifications.models import Notification
from apps.users.models import User

MENTION_PATTERN = re.compile(r'@([a-zA-Z0-9_]+)')


def parse_mentioned_usernames(content: str) -> set[str]:
    return set(MENTION_PATTERN.findall(content or ''))


def notify_comment_mentions(author, ticket, content: str) -> None:
    """Notify project members mentioned with @username in a ticket comment."""
    usernames = parse_mentioned_usernames(content)
    if not usernames:
        return

    mentioned_users = (
        User.objects.filter(
            username__in=usernames,
            projects=ticket.project,
            is_active=True,
        )
        .exclude(pk=author.pk)
        .distinct()
    )

    for user in mentioned_users:
        try:
            Notification.objects.create(
                user=user,
                message=(
                    f'{author.username} mentioned you in a comment on '
                    f'{ticket.ticket_id}: {ticket.title}'
                ),
                ticket_id=ticket.id,
                ticket_title=ticket.title[:255],
            )
        except Exception:
            pass
