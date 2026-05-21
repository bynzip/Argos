from decimal import Decimal

from rest_framework import serializers
from .models import (
    CashClosure,
    CocheraCharge,
    Discount,
    PaymentReversal,
    PaymentSchedule,
    PaymentScheduleReprogramacion,
    PaymentVoucher,
    Receipt,
    ReceiptScheduleItem,
)
from apps.users.serializers import UserSerializer

class PaymentVoucherSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentVoucher
        fields = ['id', 'archivo', 'nombre_archivo', 'created_at']


class PaymentScheduleReprogramacionSerializer(serializers.ModelSerializer):
    reprogramado_por = UserSerializer(read_only=True)

    class Meta:
        model = PaymentScheduleReprogramacion
        fields = ['id', 'fecha_anterior', 'fecha_nueva', 'motivo', 'reprogramado_por', 'created_at']


class PaymentScheduleSerializer(serializers.ModelSerializer):
    reprogramaciones = PaymentScheduleReprogramacionSerializer(many=True, read_only=True)
    saldo_pendiente = serializers.SerializerMethodField()

    class Meta:
        model = PaymentSchedule
        fields = [
            'id',
            'ticket',
            'quote',
            'numero_cuota',
            'amount',
            'monto_pagado',
            'saldo_pendiente',
            'due_date',
            'fecha_venc_original',
            'esta_pagado',
            'pagado_el',
            'veces_reprogramada',
            'reprogramaciones',
            'created_at',
            'updated_at',
        ]

    def get_saldo_pendiente(self, obj):
        monto_pagado = obj.monto_pagado
        if not isinstance(monto_pagado, Decimal):
            monto_pagado = Decimal(str(monto_pagado or 0))
        return obj.amount - monto_pagado


class ReceiptScheduleItemSerializer(serializers.ModelSerializer):
    cuota = PaymentScheduleSerializer(read_only=True)

    class Meta:
        model = ReceiptScheduleItem
        fields = ['id', 'cuota', 'monto_aplicado']


class DiscountSerializer(serializers.ModelSerializer):
    solicitado_por = UserSerializer(read_only=True)
    decidido_por = UserSerializer(read_only=True)

    class Meta:
        model = Discount
        fields = '__all__'


class PaymentReversalSerializer(serializers.ModelSerializer):
    solicitado_por = UserSerializer(read_only=True)
    aprobado_por = UserSerializer(read_only=True)

    class Meta:
        model = PaymentReversal
        fields = '__all__'


class CocheraChargeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CocheraCharge
        fields = '__all__'

class ReceiptSerializer(serializers.ModelSerializer):
    registrado_por = UserSerializer(read_only=True)
    confirmado_por = UserSerializer(read_only=True)
    vouchers = PaymentVoucherSerializer(many=True, read_only=True)
    schedule_items = ReceiptScheduleItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Receipt
        fields = [
            'id', 'folio', 'ticket', 'quote', 'tipo_recibo', 'metodo_pago', 'amount', 
            'referencia', 'estado', 'registrado_por', 'confirmado_por', 
            'confirmado_el', 'created_at', 'vouchers', 'schedule_items'
        ]

class CashClosureSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    receipts = ReceiptSerializer(many=True, read_only=True)
    
    class Meta:
        model = CashClosure
        fields = [
            'id', 'user', 'estado', 'opening_amount', 'expected_amount',
            'declared_amount', 'difference', 'opened_at', 'closed_at',
            'closing_notes', 'receipts'
        ]
