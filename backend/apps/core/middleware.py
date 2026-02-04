from django.http import JsonResponse
from django.core.cache import cache
from django.conf import settings
import time


class RateLimitMiddleware:
    """
    Rate limiting middleware to prevent abuse
    """
    def __init__(self, get_response):
        self.get_response = get_response
        self.auth_limit = getattr(settings, 'AUTH_RATE_LIMIT', '10/minute')
        self.default_limit = getattr(settings, 'DEFAULT_RATE_LIMIT', '100/minute')

    def __call__(self, request):
        # Skip rate limiting for admin panel
        if request.path.startswith('/admin/'):
            return self.get_response(request)
        
        # Get client identifier
        client_id = self._get_client_id(request)
        
        # Determine rate limit based on endpoint
        if '/auth/' in request.path:
            limit = 10  # 10 requests
            window = 60  # per 60 seconds
        else:
            limit = 100  # 100 requests
            window = 60  # per 60 seconds
        
        # Check rate limit
        cache_key = f'ratelimit:{client_id}:{request.path}'
        current = cache.get(cache_key, 0)
        
        if current >= limit:
            return JsonResponse({
                'error': 'Rate limit exceeded. Please try again later.',
                'retry_after': window
            }, status=429)
        
        # Increment counter
        cache.set(cache_key, current + 1, window)
        
        # Add rate limit headers
        response = self.get_response(request)
        response['X-RateLimit-Limit'] = str(limit)
        response['X-RateLimit-Remaining'] = str(max(0, limit - current - 1))
        
        return response

    def _get_client_id(self, request):
        """Get client identifier from request"""
        # Use authenticated user ID if available
        if hasattr(request, 'user') and request.user.is_authenticated:
            return f'user:{request.user.id}'
        
        # Otherwise use IP address
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', 'unknown')
        
        return f'ip:{ip}'
