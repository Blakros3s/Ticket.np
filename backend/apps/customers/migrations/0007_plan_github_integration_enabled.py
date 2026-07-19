from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0006_public_whiteboard_share'),
    ]

    operations = [
        migrations.AddField(
            model_name='plan',
            name='github_integration_enabled',
            field=models.BooleanField(default=False),
        ),
    ]
