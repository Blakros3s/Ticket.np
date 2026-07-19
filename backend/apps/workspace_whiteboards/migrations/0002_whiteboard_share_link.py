import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('workspace_whiteboards', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='WhiteboardShareLink',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('is_active', models.BooleanField(default=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='whiteboard_share_links', to=settings.AUTH_USER_MODEL)),
                ('whiteboard', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='share_links', to='workspace_whiteboards.whiteboard')),
            ],
            options={
                'db_table': 'workspace_whiteboard_share_links',
                'ordering': ['-created_at'],
            },
        ),
    ]
