# Generated migration for multi-assignee support

from django.db import migrations, models


def migrate_assignee_to_assignees(apps, schema_editor):
    """Copy single assignee to assignees M2M before removing assignee field"""
    Ticket = apps.get_model('tickets', 'Ticket')
    for ticket in Ticket.objects.all():
        # assignee FK still exists at this point in migration
        if ticket.assignee_id:
            ticket.assignees.add(ticket.assignee_id)


def reverse_migrate(apps, schema_editor):
    """Reverse: set assignee from first assignee in M2M (for rollback)"""
    Ticket = apps.get_model('tickets', 'Ticket')
    for ticket in Ticket.objects.all():
        first = ticket.assignees.first()
        if first:
            ticket.assignee_id = first.id
            ticket.save()


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0003_ticket_closed_at_ticket_in_progress_at_ticket_qa_at'),
        ('users', '0001_initial'),
    ]

    operations = [
        # Add assignees M2M first (blank=True so no immediate data needed)
        migrations.AddField(
            model_name='ticket',
            name='assignees',
            field=models.ManyToManyField(blank=True, related_name='assigned_tickets', to='users.user'),
        ),
        # Migrate data: assignee -> assignees
        migrations.RunPython(migrate_assignee_to_assignees, reverse_migrate),
        # Remove old assignee field
        migrations.RemoveField(
            model_name='ticket',
            name='assignee',
        ),
    ]
