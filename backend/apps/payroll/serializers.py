from decimal import Decimal

from rest_framework import serializers

from apps.payroll.models import PayrollEmployee, SalaryPayment
from apps.payroll.services.calculations import compute_base_amount, compute_payment_amounts
from apps.payroll.services.codes import allocate_next_employee_code


class PayrollEmployeeSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    employment_type_display = serializers.CharField(source='get_employment_type_display', read_only=True)
    pay_type_display = serializers.CharField(source='get_pay_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    has_payments = serializers.SerializerMethodField()

    class Meta:
        model = PayrollEmployee
        fields = [
            'id',
            'employee_code',
            'full_name',
            'phone',
            'email',
            'address',
            'role',
            'role_display',
            'employment_type',
            'employment_type_display',
            'pay_type',
            'pay_type_display',
            'base_rate',
            'date_of_joining',
            'date_of_leaving',
            'status',
            'status_display',
            'bank_name',
            'bank_account_number',
            'notes',
            'has_payments',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'employee_code', 'created_at', 'updated_at']

    def get_has_payments(self, obj: PayrollEmployee) -> bool:
        return obj.salary_payments.exists()

    def validate(self, attrs):
        joining = attrs.get('date_of_joining', getattr(self.instance, 'date_of_joining', None))
        leaving = attrs.get('date_of_leaving', getattr(self.instance, 'date_of_leaving', None))
        if joining and leaving and leaving < joining:
            raise serializers.ValidationError({'date_of_leaving': 'Leaving date cannot be before joining date.'})
        return attrs


class PayrollEmployeeCreateSerializer(PayrollEmployeeSerializer):
    class Meta(PayrollEmployeeSerializer.Meta):
        read_only_fields = ['id', 'employee_code', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['employee_code'] = allocate_next_employee_code()
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class SalaryPaymentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_code = serializers.CharField(source='employee.employee_code', read_only=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)

    class Meta:
        model = SalaryPayment
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_code',
            'period_year',
            'period_month',
            'payment_date',
            'base_amount',
            'units_worked',
            'allowances',
            'overtime',
            'bonus',
            'deductions',
            'gross_amount',
            'net_amount',
            'payment_method',
            'payment_method_display',
            'payment_status',
            'payment_status_display',
            'reference_number',
            'notes',
            'paid_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'base_amount',
            'gross_amount',
            'net_amount',
            'paid_at',
            'created_at',
            'updated_at',
        ]


class SalaryPaymentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalaryPayment
        fields = [
            'employee',
            'period_year',
            'period_month',
            'payment_date',
            'units_worked',
            'allowances',
            'overtime',
            'bonus',
            'deductions',
            'payment_method',
            'reference_number',
            'notes',
        ]

    def validate(self, attrs):
        employee = attrs['employee']
        year = attrs['period_year']
        month = attrs['period_month']

        conflict = SalaryPayment.objects.filter(
            employee=employee,
            period_year=year,
            period_month=month,
        ).exclude(payment_status=SalaryPayment.STATUS_CANCELLED)
        if self.instance:
            conflict = conflict.exclude(pk=self.instance.pk)
        if conflict.exists():
            raise serializers.ValidationError(
                'This employee already has a payment record for the selected period.'
            )

        if employee.pay_type == PayrollEmployee.PAY_TYPE_HOURLY and not attrs.get('units_worked'):
            raise serializers.ValidationError({'units_worked': 'Hours worked are required for hourly employees.'})

        return attrs

    def create(self, validated_data):
        employee = validated_data['employee']
        units_worked = validated_data.get('units_worked')
        base_amount = compute_base_amount(
            pay_type=employee.pay_type,
            base_rate=employee.base_rate,
            units_worked=units_worked,
        )
        _, gross_amount, net_amount = compute_payment_amounts(
            base_amount=base_amount,
            allowances=validated_data.get('allowances', Decimal('0')),
            overtime=validated_data.get('overtime', Decimal('0')),
            bonus=validated_data.get('bonus', Decimal('0')),
            deductions=validated_data.get('deductions', Decimal('0')),
        )
        return SalaryPayment.objects.create(
            **validated_data,
            base_amount=base_amount,
            gross_amount=gross_amount,
            net_amount=net_amount,
            created_by=self.context['request'].user,
        )


class BulkPayRowSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    units_worked = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    allowances = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal('0'))
    overtime = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal('0'))
    bonus = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal('0'))
    deductions = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=Decimal('0'))
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class BulkPaySerializer(serializers.Serializer):
    period_year = serializers.IntegerField(min_value=2000, max_value=2100)
    period_month = serializers.IntegerField(min_value=1, max_value=12)
    payment_date = serializers.DateField()
    payment_method = serializers.ChoiceField(choices=SalaryPayment.PAYMENT_METHOD_CHOICES)
    mark_paid = serializers.BooleanField(default=False)
    rows = BulkPayRowSerializer(many=True, allow_empty=False)
