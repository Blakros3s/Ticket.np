from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0004_officesettings_weekend_holidays'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='officesettings',
            name='user_terminology',
        ),
    ]
