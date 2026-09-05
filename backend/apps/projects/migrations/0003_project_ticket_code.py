import re

from django.db import migrations, models


TICKET_CODE_MAX_LENGTH = 10


def _derive_ticket_code(name: str) -> str:
    words = re.findall(r'[A-Za-z0-9]+', (name or '').strip())
    if not words:
        return 'PRJ'
    return ''.join(word[0].upper() for word in words)[:TICKET_CODE_MAX_LENGTH]


def populate_project_ticket_codes(apps, schema_editor):
    Project = apps.get_model('projects', 'Project')
    used_codes: set[str] = set()

    for project in Project.objects.order_by('id'):
        base = _derive_ticket_code(project.name)
        candidate = base
        suffix = 2

        while candidate.upper() in used_codes or Project.objects.filter(
            ticket_code__iexact=candidate
        ).exclude(pk=project.pk).exists():
            suffix_text = str(suffix)
            trimmed_base = base[: max(1, TICKET_CODE_MAX_LENGTH - len(suffix_text))]
            candidate = f'{trimmed_base}{suffix_text}'
            suffix += 1

        project.ticket_code = candidate.upper()
        project.save(update_fields=['ticket_code'])
        used_codes.add(candidate.upper())


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0002_project_github_repo_projectdocument'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='ticket_code',
            field=models.CharField(
                max_length=TICKET_CODE_MAX_LENGTH,
                null=True,
                help_text='Short code used in ticket IDs, e.g. RMS for Restaurant Management System.',
            ),
        ),
        migrations.RunPython(populate_project_ticket_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='project',
            name='ticket_code',
            field=models.CharField(
                max_length=TICKET_CODE_MAX_LENGTH,
                unique=True,
                help_text='Short code used in ticket IDs, e.g. RMS for Restaurant Management System.',
            ),
        ),
    ]
