import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('projects', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='WorkspaceDoc',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('content', models.JSONField(default=dict)),
                ('is_archived', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='workspace_docs_created', to=settings.AUTH_USER_MODEL)),
                ('project', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='workspace_docs', to='projects.project')),
            ],
            options={
                'db_table': 'workspace_docs',
                'ordering': ['-updated_at'],
            },
        ),
        migrations.CreateModel(
            name='DocVersion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('content', models.JSONField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('doc', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='versions', to='workspace_docs.workspacedoc')),
                ('edited_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='doc_versions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'workspace_doc_versions',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='DocShareLink',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('is_active', models.BooleanField(default=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='doc_share_links', to=settings.AUTH_USER_MODEL)),
                ('doc', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='share_links', to='workspace_docs.workspacedoc')),
            ],
            options={
                'db_table': 'workspace_doc_share_links',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='workspacedoc',
            index=models.Index(fields=['project', 'is_archived'], name='workspace_docs_proj_arch_idx'),
        ),
        migrations.AddIndex(
            model_name='workspacedoc',
            index=models.Index(fields=['created_by', 'is_archived'], name='workspace_docs_user_arch_idx'),
        ),
    ]
