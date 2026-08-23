from django.db import migrations, models


def init_ticket_id_counter(apps, schema_editor):
    Ticket = apps.get_model('tickets', 'Ticket')
    TicketIdCounter = apps.get_model('tickets', 'TicketIdCounter')

    max_number = 0
    for ticket_id in Ticket.objects.values_list('ticket_id', flat=True):
        if ticket_id and ticket_id.isdigit():
            max_number = max(max_number, int(ticket_id))

    TicketIdCounter.objects.update_or_create(pk=1, defaults={'last_number': max_number})


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0006_ticket_due_date'),
    ]

    operations = [
        migrations.CreateModel(
            name='TicketIdCounter',
            fields=[
                ('id', models.PositiveSmallIntegerField(default=1, primary_key=True, serialize=False)),
                ('last_number', models.PositiveIntegerField(default=0)),
            ],
            options={
                'db_table': 'ticket_id_counter',
            },
        ),
        migrations.AddConstraint(
            model_name='ticketidcounter',
            constraint=models.CheckConstraint(check=models.Q(('id', 1)), name='ticket_id_counter_singleton'),
        ),
        migrations.AlterField(
            model_name='ticket',
            name='ticket_id',
            field=models.CharField(editable=False, max_length=20, unique=True),
        ),
        migrations.RunPython(init_ticket_id_counter, migrations.RunPython.noop),
    ]
