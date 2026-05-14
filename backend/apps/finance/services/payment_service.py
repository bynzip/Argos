from django.db import transaction
from django.core.exceptions import ValidationError
from apps.core.utils import generate_folio
from apps.finance.models import Receipt, PaymentVoucher
from .cash_service import get_open_cash_closure
import hashlib
from django.utils import timezone

def calculate_file_hash(file_obj):
    sha256_hash = hashlib.sha256()
    for chunk in file_obj.chunks():
        sha256_hash.update(chunk)
    return sha256_hash.hexdigest()

def register_payment(user, ticket, amount, metodo_pago, referencia=None, voucher_file=None):
    with transaction.atomic():
        # RN-09: No se puede registrar ningA?n pago si no hay una caja abierta
        closure = get_open_cash_closure(user)
        if not closure:
            raise ValidationError("Debes abrir tu caja antes de registrar pagos.")

        # Validaciones bA?sicas
        if ticket and amount > ticket.saldo_pendiente:
            raise ValidationError(f"El monto a pagar ({amount}) supera el saldo pendiente del ticket ({ticket.saldo_pendiente}).")

        # RN-06: Efectivo se confirma automA?ticamente, digitales nacen pendientes y exigen referencia/voucher
        estado_inicial = Receipt.ReceiptStatus.CONFIRMED if metodo_pago == Receipt.PaymentMethod.CASH else Receipt.ReceiptStatus.PENDING

        if metodo_pago != Receipt.PaymentMethod.CASH:
            if not referencia:
                raise ValidationError("La referencia (número de operación) es obligatoria para pagos digitales.")
            if not voucher_file:
                raise ValidationError("Debes adjuntar el comprobante (voucher) para pagos digitales.")

        folio = generate_folio('RC')
        
        receipt = Receipt.objects.create(
            folio=folio,
            cash_closure=closure,
            ticket=ticket,
            tipo_recibo=Receipt.ReceiptType.PAYMENT,
            metodo_pago=metodo_pago,
            amount=amount,
            referencia=referencia,
            estado=estado_inicial,
            registrado_por=user,
        )

        if voucher_file:
            file_hash = calculate_file_hash(voucher_file)
            
            # RN-17: Rechazar voucher duplicado
            if PaymentVoucher.objects.filter(file_hash=file_hash).exists():
                raise ValidationError("Este comprobante ya fue utilizado en otro pago. Verifica posibles duplicados o fraudes.")
                
            PaymentVoucher.objects.create(
                receipt=receipt,
                archivo=voucher_file,
                nombre_archivo=voucher_file.name,
                file_hash=file_hash,
                subido_por=user
            )

        return receipt


def confirm_payment(user, receipt):
    with transaction.atomic():
        if receipt.estado != Receipt.ReceiptStatus.PENDING:
            raise ValidationError("Solo se pueden confirmar pagos pendientes.")

        receipt.estado = Receipt.ReceiptStatus.CONFIRMED
        receipt.confirmado_por = user
        receipt.confirmado_el = timezone.now()
        receipt.conciliado_banco = True
        receipt.save(update_fields=['estado', 'confirmado_por', 'confirmado_el', 'conciliado_banco', 'updated_at'])
        return receipt
