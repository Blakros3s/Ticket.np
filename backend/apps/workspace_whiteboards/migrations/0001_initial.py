import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('projects', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Whiteboard',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('canvas_data', models.JSONField(blank=True, default=dict)),
                ('is_archived', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='whiteboards_created', to=settings.AUTH_USER_MODEL)),
                ('last_edited_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='whiteboards_edited', to=settings.AUTH_USER_MODEL)),
                ('project', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='whiteboards', to='projects.project')),
            ],
            options={
                'db_table': 'workspace_whiteboards',
                'ordering': ['-updated_at'],
            },
        ),
        migrations.CreateModel(
            name='WhiteboardVersion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('canvas_data', models.JSONField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('edited_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='whiteboard_versions', to=settings.AUTH_USER_MODEL)),
                ('whiteboard', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='versions', to='workspace_whiteboards.whiteboard')),
            ],
            options={
                'db_table': 'workspace_whiteboard_versions',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='whiteboard',
            index=models.Index(fields=['project', 'is_archived'], name='workspace_w_project_6f0f0d_idx'),
        ),
        migrations.AddIndex(
            model_name='whiteboard',
            index=models.Index(fields=['created_by', 'is_archived'], name='workspace_w_created_0a8f2a_idx'),
        ),
    ]
