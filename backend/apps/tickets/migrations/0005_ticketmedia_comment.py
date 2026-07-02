from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('comments', '0001_initial'),
        ('tickets', '0004_replace_assignee_with_assignees'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticketmedia',
            name='comment',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='media_files',
                to='comments.comment',
            ),
        ),
    ]
