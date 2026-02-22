from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.attendance.models import Attendance
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Automatically mark users absent if they have not marked attendance by the end of the day'

    def handle(self, *args, **options):
        # We assume this runs at the end of the day, so check for today.
        today = timezone.localdate()
        
        # Check if today is a working day
        if not Attendance.is_working_day(today):
            self.stdout.write(self.style.SUCCESS(f'Skipped. {today} is not a working day.'))
            return
            
        users = User.objects.filter(is_active=True, is_staff=False, is_superuser=False)
        absent_count = 0
        
        for user in users:
            attendance, created = Attendance.objects.get_or_create(
                employee=user,
                date=today,
                defaults={'status': 'neutral'}
            )
            
            # If status is still neutral (i.e., they never marked available/unavailable)
            if attendance.status == 'neutral':
                attendance.mark_absent()
                absent_count += 1
                
        self.stdout.write(self.style.SUCCESS(f'Successfully marked {absent_count} users as absent for {today}.'))
