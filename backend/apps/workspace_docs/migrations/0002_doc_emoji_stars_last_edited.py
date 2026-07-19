import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workspace_docs', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='workspacedoc',
            name='emoji',
            field=models.CharField(blank=True, default='', max_length=16),
        ),
        migrations.AddField(
            model_name='workspacedoc',
            name='last_edited_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='workspace_docs_edited',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.CreateModel(
            name='WorkspaceDocStar',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('doc', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stars', to='workspace_docs.workspacedoc')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='starred_workspace_docs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'workspace_doc_stars',
            },
        ),
        migrations.AddConstraint(
            model_name='workspacedocstar',
            constraint=models.UniqueConstraint(fields=('user', 'doc'), name='workspace_doc_star_user_doc_unique'),
        ),
    ]
