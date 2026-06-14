from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0003_officesettings_user_terminology'),
    ]

    operations = [
        migrations.AddField(
            model_name='officesettings',
            name='weekend_holidays',
            field=models.CharField(
                choices=[
                    ('saturday', 'Saturday only'),
                    ('sunday', 'Sunday only'),
                    ('both', 'Saturday and Sunday'),
                ],
                default='saturday',
                help_text='Weekly off-days when attendance is not required',
                max_length=10,
            ),
        ),
    ]
