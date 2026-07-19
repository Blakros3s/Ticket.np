from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models


class PlatformUserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError('Platform users must have a username.')
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault('is_active', True)
        return self.create_user(username, password, **extra_fields)


class PlatformUser(AbstractBaseUser):
    """Server admin — lives in public schema only; manages tenants platform-wide."""

    ROLE = 'server_admin'

    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(blank=True, default='')
    first_name = models.CharField(max_length=150, blank=True, default='')
    last_name = models.CharField(max_length=150, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = PlatformUserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    class Meta:
        db_table = 'platform_platformuser'

    def __str__(self) -> str:
        return self.username

    @property
    def role(self) -> str:
        return self.ROLE

    @property
    def is_staff(self) -> bool:
        return True

    @property
    def is_superuser(self) -> bool:
        return True

    def has_perm(self, perm, obj=None) -> bool:
        return self.is_active

    def has_module_perms(self, app_label) -> bool:
        return self.is_active
