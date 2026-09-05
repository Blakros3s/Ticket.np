from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.utils import timezone


class UserRole(models.Model):
    """Model for storing user department roles like Frontend, Backend, DevOps, etc."""
    name = models.CharField(max_length=50, unique=True)
    display_name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default='#6b7280', help_text="Hex color code")
    
    class Meta:
        db_table = 'user_roles'
        verbose_name = 'User Role'
        verbose_name_plural = 'User Roles'
        ordering = ['display_name']
    
    def __str__(self):
        return self.display_name


class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('employee', 'Developer'),
        ('manager', 'Manager'),
    ]
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='employee')
    department_roles = models.ManyToManyField(UserRole, blank=True, related_name='users')
    date_of_joining = models.DateField(null=True, blank=True)
    date_of_leaving = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

    def get_employment_start(self):
        if self.date_of_joining:
            return self.date_of_joining
        if self.date_joined:
            return timezone.localtime(self.date_joined).date()
        return timezone.localdate()

    def is_employed_on(self, check_date) -> bool:
        if self.role == 'admin':
            return False
        if check_date < self.get_employment_start():
            return False
        if self.date_of_leaving and check_date > self.date_of_leaving:
            return False
        if not self.is_active:
            return False
        return True

    @classmethod
    def attendance_trackable_queryset(cls, for_date=None):
        check_date = for_date or timezone.localdate()
        return cls.objects.filter(is_active=True).exclude(role='admin').filter(
            Q(date_of_joining__isnull=True) | Q(date_of_joining__lte=check_date),
        ).filter(
            Q(date_of_leaving__isnull=True) | Q(date_of_leaving__gte=check_date),
        )

    @classmethod
    def attendance_report_queryset(cls, start_date, end_date):
        return cls.objects.filter(is_active=True).exclude(role='admin').filter(
            Q(date_of_joining__isnull=True) | Q(date_of_joining__lte=end_date),
        ).filter(
            Q(date_of_leaving__isnull=True) | Q(date_of_leaving__gte=start_date),
        )
    
    def is_admin(self):
        return self.role == 'admin'
    
    def is_manager(self):
        return self.role == 'manager'
    
    def get_department_roles_display(self):
        """Return a list of user's department role names."""
        return [role.display_name for role in self.department_roles.all()]
