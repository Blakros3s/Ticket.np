from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db import connections
from django.db.utils import OperationalError


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint for monitoring and load balancers
    """
    status = {
        'status': 'healthy',
        'database': 'connected',
        'api': 'running'
    }
    
    # Check database connection
    try:
        connections['default'].cursor()
    except OperationalError:
        status['status'] = 'unhealthy'
        status['database'] = 'disconnected'
        return Response(status, status=503)
    
    return Response(status)
