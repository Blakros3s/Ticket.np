from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0007_sequential_ticket_ids'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='module',
            field=models.CharField(
                blank=True,
                default=None,
                help_text='Optional project area (e.g. notifications, settings)',
                max_length=100,
                null=True,
            ),
        ),
    ]
