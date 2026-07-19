# Generated manually for integrations app

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('tickets', '0006_ticket_due_date'),
        ('users', '0003_alter_userrole_name'),
    ]

    operations = [
        migrations.CreateModel(
            name='GitHubConnection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('github_user_id', models.PositiveBigIntegerField()),
                ('github_login', models.CharField(max_length=255)),
                ('access_token_encrypted', models.TextField()),
                ('token_scope', models.CharField(blank=True, max_length=255)),
                ('webhook_secret', models.CharField(blank=True, max_length=64)),
                ('connected_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('connected_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='github_connections', to='users.user')),
            ],
            options={
                'verbose_name': 'GitHub connection',
                'db_table': 'integrations_github_connection',
            },
        ),
        migrations.CreateModel(
            name='TicketGitHubLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('repo_owner', models.CharField(max_length=255)),
                ('repo_name', models.CharField(max_length=255)),
                ('issue_number', models.PositiveIntegerField()),
                ('github_issue_id', models.PositiveBigIntegerField()),
                ('issue_url', models.URLField(max_length=500)),
                ('sync_status', models.CharField(choices=[('linked', 'Linked'), ('error', 'Error'), ('disconnected', 'Disconnected')], default='linked', max_length=20)),
                ('last_sync_error', models.TextField(blank=True)),
                ('last_synced_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('ticket', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='github_link', to='tickets.ticket')),
            ],
            options={
                'db_table': 'integrations_ticket_github_link',
            },
        ),
        migrations.AddConstraint(
            model_name='ticketgithublink',
            constraint=models.UniqueConstraint(fields=('repo_owner', 'repo_name', 'issue_number'), name='integrations_unique_github_issue_per_repo'),
        ),
    ]
