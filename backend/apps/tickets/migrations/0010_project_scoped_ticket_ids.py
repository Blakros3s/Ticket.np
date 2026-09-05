from django.db import migrations, models
import django.db.models.deletion


def renumber_project_scoped_ticket_ids(apps, schema_editor):
    Project = apps.get_model('projects', 'Project')
    Ticket = apps.get_model('tickets', 'Ticket')

    updates: list[tuple[int, str]] = []
    for project in Project.objects.order_by('id'):
        tickets = list(
            Ticket.objects.filter(project_id=project.id).order_by('created_at', 'id')
        )
        for index, ticket in enumerate(tickets, start=1):
            updates.append((ticket.id, f'TKT-{project.ticket_code}-{str(index).zfill(4)}'))

    if not updates:
        return

    for ticket_id, _ in updates:
        Ticket.objects.filter(pk=ticket_id).update(ticket_id=f'__migrate_{ticket_id}')

    for ticket_id, new_ticket_id in updates:
        Ticket.objects.filter(pk=ticket_id).update(ticket_id=new_ticket_id)


def init_project_ticket_counters(apps, schema_editor):
    Project = apps.get_model('projects', 'Project')
    Ticket = apps.get_model('tickets', 'Ticket')
    TicketIdCounter = apps.get_model('tickets', 'TicketIdCounter')

    for project in Project.objects.order_by('id'):
        last_number = Ticket.objects.filter(project_id=project.id).count()
        TicketIdCounter.objects.create(project_id=project.id, last_number=last_number)


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0003_project_ticket_code'),
        ('tickets', '0009_ticket_id_tkt_prefix'),
    ]

    operations = [
        migrations.AlterField(
            model_name='ticket',
            name='ticket_id',
            field=models.CharField(editable=False, max_length=32, unique=True),
        ),
        migrations.RunPython(renumber_project_scoped_ticket_ids, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name='ticketidcounter',
            name='ticket_id_counter_singleton',
        ),
        migrations.DeleteModel(
            name='TicketIdCounter',
        ),
        migrations.CreateModel(
            name='TicketIdCounter',
            fields=[
                ('last_number', models.PositiveIntegerField(default=0)),
                (
                    'project',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        primary_key=True,
                        related_name='ticket_id_counter',
                        serialize=False,
                        to='projects.project',
                    ),
                ),
            ],
            options={
                'db_table': 'ticket_id_counter',
            },
        ),
        migrations.RunPython(init_project_ticket_counters, migrations.RunPython.noop),
    ]
