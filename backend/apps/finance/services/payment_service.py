import hashlib

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.core.utils import generate_folio
from apps.finance.models import PaymentVoucher, Receipt

from .advanced_service import apply_receipt_to_schedules, persist_receipt_schedule_items
from .cash_service import get_open_cash_closure


def calculate_file_hash(file_obj):
    sha256_hash = hashlib.sha256()
    for chunk in file_obj.chunks():
        sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


def get_payment_context_balance(*, quote=None, ticket=None):
    if quote:
        return quote.saldo_pendiente
    if ticket:
        return ticket.saldo_pendiente
    return 0


def maybe_consume_direct_quote_stock(*, receipt, user):
    if not receipt.quote_id or receipt.quote.quote_type != 'DIRECT':
        return

    from apps.products.services import consume_direct_quote_stock

    consume_direct_quote_stock(quote=receipt.quote, user=user)


def register_payment(
    user,
    quote=None,
    ticket=None,
    amount=None,
    metodo_pago=None,
    referencia=None,
    voucher_file=None,
    tipo_recibo=None,
    schedule_items=None,
):
    with transaction.atomic():
        if not quote and not ticket:
            raise ValidationError("Debes indicar una cotizacion o ticket para registrar el pago.")

        closure = get_open_cash_closure(user)
        if not closure:
            raise ValidationError("Debes abrir tu caja antes de registrar pagos.")

        saldo_pendiente = get_payment_context_balance(quote=quote, ticket=ticket)
        if amount > saldo_pendiente:
            raise ValidationError(f"El monto a pagar ({amount}) supera el saldo pendiente ({saldo_pendiente}).")

        estado_inicial = Receipt.ReceiptStatus.CONFIRMED if metodo_pago == Receipt.PaymentMethod.CASH else Receipt.ReceiptStatus.PENDING

        if metodo_pago != Receipt.PaymentMethod.CASH:
            if not referencia:
                raise ValidationError("La referencia (numero de operacion) es obligatoria para pagos digitales.")
            if not voucher_file:
                raise ValidationError("Debes adjuntar el comprobante (voucher) para pagos digitales.")

        receipt = Receipt.objects.create(
            folio=generate_folio('RC'),
            cash_closure=closure,
            ticket=ticket,
            quote=quote,
            tipo_recibo=tipo_recibo or Receipt.ReceiptType.PAYMENT,
            metodo_pago=metodo_pago,
            amount=amount,
            referencia=referencia,
            estado=estado_inicial,
            registrado_por=user,
        )

        if voucher_file:
            file_hash = calculate_file_hash(voucher_file)
            if PaymentVoucher.objects.filter(file_hash=file_hash).exists():
                raise ValidationError("Este comprobante ya fue utilizado en otro pago. Verifica posibles duplicados o fraudes.")

            PaymentVoucher.objects.create(
                receipt=receipt,
                archivo=voucher_file,
                nombre_archivo=voucher_file.name,
                file_hash=file_hash,
                subido_por=user,
            )

        if estado_inicial == Receipt.ReceiptStatus.PENDING and schedule_items:
            persist_receipt_schedule_items(receipt=receipt, schedule_items=schedule_items)

        if estado_inicial == Receipt.ReceiptStatus.CONFIRMED:
            apply_receipt_to_schedules(receipt=receipt, schedule_items=schedule_items)
            maybe_consume_direct_quote_stock(receipt=receipt, user=user)

        return receipt


def confirm_payment(user, receipt, schedule_items=None):
    with transaction.atomic():
        if receipt.estado != Receipt.ReceiptStatus.PENDING:
            raise ValidationError("Solo se pueden confirmar pagos pendientes.")

        receipt.estado = Receipt.ReceiptStatus.CONFIRMED
        receipt.confirmado_por = user
        receipt.confirmado_el = timezone.now()
        receipt.conciliado_banco = True
        receipt.save(update_fields=['estado', 'confirmado_por', 'confirmado_el', 'conciliado_banco', 'updated_at'])
        apply_receipt_to_schedules(receipt=receipt, schedule_items=schedule_items)
        maybe_consume_direct_quote_stock(receipt=receipt, user=user)
        return receipt
