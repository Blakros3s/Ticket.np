from rest_framework import serializers

from apps.customers.models import Plan, SubscriptionStatus


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            'id',
            'name',
            'tier',
            'monthly_price',
            'max_users',
            'max_projects',
            'attendance_enabled',
            'calendar_enabled',
            'email_notifications_enabled',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AssignPlanSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField()
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')


def build_subscription_summary(subscription) -> dict | None:
    if subscription is None:
        return None
    return {
        'plan_id': subscription.plan_id,
        'plan_name': subscription.plan.name,
        'plan_tier': subscription.plan.tier,
        'status': subscription.status,
        'expires_at': subscription.expires_at,
        'is_effectively_expired': subscription.is_effectively_expired,
    }


def build_subscription_detail(subscription, *, usage: dict[str, int] | None = None) -> dict:
    data = build_subscription_summary(subscription) or {}
    data.update({
        'started_at': subscription.started_at,
        'notes': subscription.notes,
        'limits': {
            'max_users': subscription.plan.max_users,
            'max_projects': subscription.plan.max_projects,
            'attendance_enabled': subscription.plan.attendance_enabled,
            'calendar_enabled': subscription.plan.calendar_enabled,
            'email_notifications_enabled': subscription.plan.email_notifications_enabled,
        },
        'usage': usage or {},
    })
    return data
