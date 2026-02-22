from django.contrib.contenttypes.models import ContentType
from .models import ActivityLog


def log_activity(action, user, instance=None, description=None, extra_data=None):
    """
    Log an activity to the ActivityLog model.
    
    Args:
        action: One of the ACTION_CHOICES values
        user: The user who performed the action
        instance: The model instance related to the activity (optional)
        description: A description of the activity (optional)
        extra_data: Additional JSON data (optional)
    """
    content_type = None
    object_id = None
    
    if instance:
        content_type = ContentType.objects.get_for_model(instance)
        object_id = instance.id
    
    ActivityLog.objects.create(
        action=action,
        user=user,
        content_type=content_type,
        object_id=object_id,
        description=description or f"{action} performed",
        extra_data=extra_data or {}
    )
