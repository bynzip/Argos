from django.db import models
from django.conf import settings
from apps.tickets.models import Ticket
from django.utils import timezone

class CashClosure(models.Model):
    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Abierta'
        CLOSED = 'CLOSED', 'Cerrada'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.RESTRICT, related_name='cash_closures')
    estado = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    opening_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    expected_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    declared_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    difference = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    opened_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(null=True, blank=True)
    closing_notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'cash_closures'
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['estado']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'estado'],
                condition=models.Q(estado='OPEN'),
                name='unique_open_cash_closure_per_user'
            )
        ]

    def __str__(self):
        return f"Caja {self.id} - {self.user.nombre}"

class Receipt(models.Model):
    class ReceiptType(models.TextChoices):
        PAYMENT = 'PAYMENT', 'Pago'
        ADVANCE = 'ADVANCE', 'Adelanto'
        INSTALLMENT = 'INSTALLMENT', 'Cuota'

    class PaymentMethod(models.TextChoices):
        CASH = 'CASH', 'Efectivo'
        TRANSFER = 'TRANSFER', 'Transferencia'
        CARD = 'CARD', 'Tarjeta'
        YAPE = 'YAPE', 'Yape'
        PLIN = 'PLIN', 'Plin'

    class ReceiptStatus(models.TextChoices):
        REGISTERED = 'REGISTERED', 'Registrado'
        PENDING = 'PENDING', 'Pendiente'
        CONFIRMED = 'CONFIRMED', 'Confirmado'
        REJECTED = 'REJECTED', 'Rechazado'
        REVERSED = 'REVERSED', 'Reversado'

    folio = models.CharField(max_length=20, unique=True)
    cash_closure = models.ForeignKey(CashClosure, on_delete=models.RESTRICT, related_name='receipts')
    ticket = models.ForeignKey(Ticket, on_delete=models.SET_NULL, null=True, blank=True, related_name='receipts')

    tipo_recibo = models.CharField(max_length=20, choices=ReceiptType.choices, default=ReceiptType.PAYMENT)
    metodo_pago = models.CharField(max_length=20, choices=PaymentMethod.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    referencia = models.CharField(max_length=200, null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ReceiptStatus.choices, default=ReceiptStatus.REGISTERED)
    
    conciliado_banco = models.BooleanField(default=False)
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='registered_receipts')
    confirmado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='confirmed_receipts')
    confirmado_el = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'receipts'
        indexes = [
            models.Index(fields=['folio']),
            models.Index(fields=['ticket']),
            models.Index(fields=['estado']),
            models.Index(fields=['cash_closure']),
        ]

    def __str__(self):
        return self.folio

class PaymentVoucher(models.Model):
    receipt = models.ForeignKey(Receipt, on_delete=models.CASCADE, related_name='vouchers')
    archivo = models.FileField(upload_to='tickets/vouchers/%Y/%m/%d/', max_length=500)
    nombre_archivo = models.CharField(max_length=255)
    file_hash = models.CharField(max_length=64, unique=True)
    subido_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payment_vouchers'

    def __str__(self):
        return f"Voucher {self.receipt.folio}"

class PaymentReversal(models.Model):
    class ReversalType(models.TextChoices):
        REVERSAL = 'REVERSAL', 'Reversa'
        REFUND = 'REFUND', 'Reembolso'
        CREDIT = 'CREDIT', 'Crédito'

    class ReversalStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pendiente'
        APPROVED = 'APPROVED', 'Aprobado'
        REJECTED = 'REJECTED', 'Rechazado'

    receipt = models.ForeignKey(Receipt, on_delete=models.RESTRICT, related_name='reversals')
    tipo_reversa = models.CharField(max_length=20, choices=ReversalType.choices)
    motivo = models.TextField()
    solicitado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='requested_reversals')
    aprobado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_reversals')
    estado = models.CharField(max_length=20, choices=ReversalStatus.choices, default=ReversalStatus.PENDING)
    aprobado_el = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payment_reversals'

class PaymentSchedule(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='schedules')
    numero_cuota = models.IntegerField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    monto_pagado = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    due_date = models.DateField()
    fecha_venc_original = models.DateField()
    esta_pagado = models.BooleanField(default=False)
    pagado_el = models.DateTimeField(null=True, blank=True)
    veces_reprogramada = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payment_schedules'
        indexes = [
            models.Index(fields=['ticket']),
            models.Index(fields=['due_date']),
            models.Index(fields=['esta_pagado']),
        ]

class PaymentScheduleReprogramacion(models.Model):
    cuota = models.ForeignKey(PaymentSchedule, on_delete=models.CASCADE, related_name='reprogramaciones')
    fecha_anterior = models.DateField()
    fecha_nueva = models.DateField()
    motivo = models.TextField()
    reprogramado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payment_schedule_reprogramaciones'

class ReceiptScheduleItem(models.Model):
    receipt = models.ForeignKey(Receipt, on_delete=models.CASCADE, related_name='schedule_items')
    cuota = models.ForeignKey(PaymentSchedule, on_delete=models.CASCADE, related_name='receipt_items')
    monto_aplicado = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'receipt_schedule_items'
        unique_together = ('receipt', 'cuota')

class Discount(models.Model):
    class DiscountType(models.TextChoices):
        PERCENTAGE = 'PERCENTAGE', 'Porcentaje'
        FIXED_AMOUNT = 'FIXED_AMOUNT', 'Monto Fijo'

    class DiscountStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pendiente'
        APPROVED = 'APPROVED', 'Aprobado'
        REJECTED = 'REJECTED', 'Rechazada'

    ticket = models.ForeignKey(Ticket, on_delete=models.SET_NULL, null=True, blank=True, related_name='discounts')
    tipo_descuento = models.CharField(max_length=20, choices=DiscountType.choices)
    respuesta = models.DecimalField(max_digits=12, decimal_places=2) # El porcentaje o monto
    motivo = models.TextField()
    estado = models.CharField(max_length=20, choices=DiscountStatus.choices, default=DiscountStatus.PENDING)
    solicitado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='requested_discounts')
    decidido_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='decided_discounts')
    decidido_el = models.DateTimeField(null=True, blank=True)
    notas_admin = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'discounts'

class CocheraCharge(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='cochera_charges')
    charge_date = models.DateField()
    tarifa_diaria = models.DecimalField(max_digits=12, decimal_places=2)
    esta_pagado = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'cochera_charges'
        unique_together = ('ticket', 'charge_date')
