from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0005_ticketmedia_comment'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='due_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name='ticket',
            index=models.Index(fields=['due_date'], name='tickets_due_date_idx'),
        ),
        migrations.AddIndex(
            model_name='ticket',
            index=models.Index(fields=['project', 'status'], name='tickets_project_status_idx'),
        ),
    ]
