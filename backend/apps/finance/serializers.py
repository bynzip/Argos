from rest_framework import serializers
from .models import CashClosure, Receipt, PaymentVoucher
from apps.users.serializers import UserSerializer

class PaymentVoucherSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentVoucher
        fields = ['id', 'archivo', 'nombre_archivo', 'created_at']

class ReceiptSerializer(serializers.ModelSerializer):
    registrado_por = UserSerializer(read_only=True)
    confirmado_por = UserSerializer(read_only=True)
    vouchers = PaymentVoucherSerializer(many=True, read_only=True)
    
    class Meta:
        model = Receipt
        fields = [
            'id', 'folio', 'tipo_recibo', 'metodo_pago', 'amount', 
            'referencia', 'estado', 'registrado_por', 'confirmado_por', 
            'confirmado_el', 'created_at', 'vouchers'
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
