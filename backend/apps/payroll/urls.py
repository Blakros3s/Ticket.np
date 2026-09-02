from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.payroll.views import PayrollEmployeeViewSet, SalaryPaymentViewSet

router = DefaultRouter()
router.register('employees', PayrollEmployeeViewSet, basename='payroll-employee')
router.register('payments', SalaryPaymentViewSet, basename='salary-payment')

urlpatterns = [
    path('', include(router.urls)),
]
