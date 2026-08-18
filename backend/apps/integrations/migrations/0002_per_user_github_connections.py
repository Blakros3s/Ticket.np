from django.db import migrations, models
import django.db.models.deletion


def migrate_connections_to_per_user(apps, schema_editor):
    GitHubConnection = apps.get_model('integrations', 'GitHubConnection')
    GitHubTenantConfig = apps.get_model('integrations', 'GitHubTenantConfig')

    secret = ''
    for row in GitHubConnection.objects.all().order_by('connected_at'):
        if row.webhook_secret:
            secret = row.webhook_secret
        if row.connected_by_id and not GitHubConnection.objects.filter(user_id=row.connected_by_id).exists():
            row.user_id = row.connected_by_id
            row.save(update_fields=['user_id'])

    if secret:
        GitHubTenantConfig.objects.update_or_create(pk=1, defaults={'webhook_secret': secret})

    # Remove legacy rows without a user assignment.
    GitHubConnection.objects.filter(user_id__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('integrations', '0001_initial'),
        ('users', '0003_alter_userrole_name'),
    ]

    operations = [
        migrations.CreateModel(
            name='GitHubTenantConfig',
            fields=[
                ('id', models.PositiveSmallIntegerField(default=1, primary_key=True, serialize=False)),
                ('webhook_secret', models.CharField(blank=True, max_length=64)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'integrations_github_tenant_config',
            },
        ),
        migrations.AddConstraint(
            model_name='githubtenantconfig',
            constraint=models.CheckConstraint(check=models.Q(('id', 1)), name='integrations_github_tenant_config_singleton'),
        ),
        migrations.AddField(
            model_name='ticketgithublink',
            name='linked_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='github_issues_created',
                to='users.user',
            ),
        ),
        migrations.AddField(
            model_name='githubconnection',
            name='user',
            field=models.OneToOneField(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='github_connection',
                to='users.user',
            ),
        ),
        migrations.RunPython(migrate_connections_to_per_user, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='githubconnection',
            name='connected_by',
        ),
        migrations.RemoveField(
            model_name='githubconnection',
            name='webhook_secret',
        ),
        migrations.AlterField(
            model_name='githubconnection',
            name='user',
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='github_connection',
                to='users.user',
            ),
        ),
    ]
