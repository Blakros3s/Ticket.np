# Generated manually for UserRole model

from django.db import migrations, models


def create_default_roles(apps, schema_editor):
    """Create default department roles"""
    UserRole = apps.get_model('users', 'UserRole')
    
    roles = [
        ('frontend', 'Frontend', '#3b82f6'),      # blue-500
        ('backend', 'Backend', '#10b981'),        # emerald-500
        ('devops', 'DevOps', '#f59e0b'),          # amber-500
        ('qa', 'QA Engineer', '#8b5cf6'),         # violet-500
        ('ui_ux', 'UI/UX Designer', '#ec4899'),   # pink-500
        ('product', 'Product Manager', '#ef4444'), # red-500
        ('project', 'Project Manager', '#06b6d4'), # cyan-500
        ('data', 'Data Engineer', '#84cc16'),     # lime-500
        ('mobile', 'Mobile Developer', '#f97316'), # orange-500
        ('fullstack', 'Full Stack Developer', '#6366f1'), # indigo-500
        ('security', 'Security Engineer', '#dc2626'), # red-600
        ('database', 'Database Administrator', '#0891b2'), # cyan-600
    ]
    
    for name, display_name, color in roles:
        UserRole.objects.get_or_create(
            name=name,
            defaults={'display_name': display_name, 'color': color}
        )


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserRole',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True, choices=[
                    ('frontend', 'Frontend'),
                    ('backend', 'Backend'),
                    ('devops', 'DevOps'),
                    ('qa', 'QA Engineer'),
                    ('ui_ux', 'UI/UX Designer'),
                    ('product', 'Product Manager'),
                    ('project', 'Project Manager'),
                    ('data', 'Data Engineer'),
                    ('mobile', 'Mobile Developer'),
                    ('fullstack', 'Full Stack Developer'),
                    ('security', 'Security Engineer'),
                    ('database', 'Database Administrator'),
                ])),
                ('display_name', models.CharField(max_length=100)),
                ('color', models.CharField(default='#6b7280', help_text='Hex color code', max_length=7)),
            ],
            options={
                'verbose_name': 'User Role',
                'verbose_name_plural': 'User Roles',
                'db_table': 'user_roles',
                'ordering': ['display_name'],
            },
        ),
        migrations.AddField(
            model_name='user',
            name='department_roles',
            field=models.ManyToManyField(blank=True, related_name='users', to='users.userrole'),
        ),
        migrations.RunPython(create_default_roles),
    ]
