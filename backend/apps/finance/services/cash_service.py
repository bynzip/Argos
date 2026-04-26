from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Sum
from apps.finance.models import CashClosure, Receipt

def get_open_cash_closure(user):
    return CashClosure.objects.filter(user=user, estado=CashClosure.Status.OPEN).first()

def open_cash_closure(user, opening_amount):
    with transaction.atomic():
        if get_open_cash_closure(user):
            raise ValidationError("Ya tienes una caja abierta. Ciérrala antes de abrir una nueva.")
            
        return CashClosure.objects.create(
            user=user,
            opening_amount=opening_amount,
            estado=CashClosure.Status.OPEN
        )

def close_cash_closure(user, declared_amount, notes=None):
    with transaction.atomic():
        closure = get_open_cash_closure(user)
        if not closure:
            raise ValidationError("No tienes ninguna caja abierta para cerrar.")
            
        # Calcular el monto esperado: monto de apertura + todos los recibos en EFECTIVO confirmados
        cash_receipts_total = closure.receipts.filter(
            estado=Receipt.ReceiptStatus.CONFIRMED,
            metodo_pago=Receipt.PaymentMethod.CASH
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        expected_amount = closure.opening_amount + cash_receipts_total
        difference = declared_amount - expected_amount
        
        closure.expected_amount = expected_amount
        closure.declared_amount = declared_amount
        closure.difference = difference
        closure.closing_notes = notes
        closure.estado = CashClosure.Status.CLOSED
        closure.closed_at = timezone.now()
        
        closure.save()
        return closure
