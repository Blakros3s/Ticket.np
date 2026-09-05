from django.db import migrations, models
from django.utils import timezone


def backfill_date_of_joining(apps, schema_editor):
    User = apps.get_model('users', 'User')
    for user in User.objects.all().iterator():
        if user.date_of_joining:
            continue
        if user.date_joined:
            user.date_of_joining = timezone.localtime(user.date_joined).date()
        else:
            user.date_of_joining = timezone.localdate()
        user.save(update_fields=['date_of_joining'])


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_alter_userrole_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='date_of_joining',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='date_of_leaving',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_date_of_joining, migrations.RunPython.noop),
    ]
