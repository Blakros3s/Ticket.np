from django.db import migrations


def enable_github_on_premium(apps, schema_editor):
    Plan = apps.get_model('customers', 'Plan')
    Plan.objects.filter(name='Premium').update(github_integration_enabled=True)


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0007_plan_github_integration_enabled'),
    ]

    operations = [
        migrations.RunPython(enable_github_on_premium, migrations.RunPython.noop),
    ]
