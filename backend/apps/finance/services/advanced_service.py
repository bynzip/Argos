import json
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.core.audit import log_audit
from apps.core.models import CompanyProfile
from apps.customers.models import Customer
from apps.finance.models import (
    CocheraCharge,
    Discount,
    PaymentReversal,
    PaymentSchedule,
    PaymentScheduleReprogramacion,
    Receipt,
    ReceiptScheduleItem,
)
from apps.users.permissions import require_permission


def parse_schedule_items(schedule_items_raw):
    if not schedule_items_raw:
        return []
    if isinstance(schedule_items_raw, str):
        try:
            return json.loads(schedule_items_raw)
        except json.JSONDecodeError as exc:
            raise ValidationError({'schedule_items': 'Formato invalido.'}) from exc
    return schedule_items_raw


def sync_customer_morosidad(customer: Customer):
    today = timezone.now().date()
    overdue_exists = PaymentSchedule.objects.filter(
        ticket__customer=customer,
        esta_pagado=False,
        due_date__lt=today,
    ).exists()
    if overdue_exists:
        if customer.etiqueta != 'MOROSO':
            customer.etiqueta_anterior = customer.etiqueta
            customer.etiqueta = 'MOROSO'
            customer.veces_moroso = (customer.veces_moroso or 0) + 1
            customer.save(update_fields=['etiqueta', 'etiqueta_anterior', 'veces_moroso', 'updated_at'])
    elif customer.etiqueta == 'MOROSO':
        customer.etiqueta = customer.etiqueta_anterior or 'REGULAR'
        customer.save(update_fields=['etiqueta', 'updated_at'])
    return customer


@transaction.atomic
def apply_receipt_to_schedules(*, receipt, schedule_items):
    parsed_items = parse_schedule_items(schedule_items)
    if not parsed_items:
        return receipt

    for raw_item in parsed_items:
        schedule = PaymentSchedule.objects.select_for_update().get(ticket=receipt.ticket, pk=raw_item['schedule_id'])
        amount = Decimal(str(raw_item['amount']))
        saldo = schedule.amount - schedule.monto_pagado
        if amount <= 0:
            raise ValidationError({'amount': 'El monto aplicado debe ser mayor a 0.'})
        if amount > saldo:
            raise ValidationError({'amount': f'El monto aplicado supera el saldo de la cuota {schedule.numero_cuota}.'})

        ReceiptScheduleItem.objects.create(receipt=receipt, cuota=schedule, monto_aplicado=amount)
        schedule.monto_pagado += amount
        if schedule.monto_pagado >= schedule.amount:
            schedule.esta_pagado = True
            schedule.pagado_el = timezone.now()
        schedule.save(update_fields=['monto_pagado', 'esta_pagado', 'pagado_el', 'updated_at'])

    if receipt.ticket_id:
        sync_customer_morosidad(receipt.ticket.customer)
    return receipt


@transaction.atomic
def create_payment_schedule(*, ticket, user, installments):
    require_permission(user, 'finance.manage_schedules')
    if not installments:
        raise ValidationError({'installments': 'Debes enviar al menos una cuota.'})

    ticket.schedules.all().delete()
    created = []
    for index, raw_installment in enumerate(installments, start=1):
        schedule = PaymentSchedule.objects.create(
            ticket=ticket,
            numero_cuota=index,
            amount=Decimal(str(raw_installment['amount'])),
            due_date=raw_installment['due_date'],
            fecha_venc_original=raw_installment['due_date'],
        )
        created.append(schedule)

    log_audit(module='finance', action='CREATE', user=user, obj=ticket, after_data={'schedules': len(created)})
    sync_customer_morosidad(ticket.customer)
    return created


@transaction.atomic
def reprogram_schedule(*, schedule, user, new_date, motivo):
    require_permission(user, 'finance.manage_schedules')
    previous_date = schedule.due_date
    PaymentScheduleReprogramacion.objects.create(
        cuota=schedule,
        fecha_anterior=previous_date,
        fecha_nueva=new_date,
        motivo=motivo,
        reprogramado_por=user,
    )
    schedule.due_date = new_date
    schedule.veces_reprogramada += 1
    schedule.save(update_fields=['due_date', 'veces_reprogramada', 'updated_at'])
    sync_customer_morosidad(schedule.ticket.customer)
    log_audit(module='finance', action='UPDATE', user=user, obj=schedule, before_data={'due_date': str(previous_date)}, after_data={'due_date': str(schedule.due_date)})
    return schedule


@transaction.atomic
def request_discount(*, ticket, user, tipo_descuento, respuesta, motivo):
    require_permission(user, 'finance.request_discount')
    discount = Discount.objects.create(
        ticket=ticket,
        tipo_descuento=tipo_descuento,
        respuesta=Decimal(str(respuesta)),
        motivo=motivo,
        solicitado_por=user,
    )
    log_audit(module='finance', action='CREATE', user=user, obj=discount, after_data={'ticket_id': str(ticket.id), 'respuesta': str(discount.respuesta)})
    return discount


@transaction.atomic
def decide_discount(*, discount, user, approve, notas_admin=''):
    require_permission(user, 'finance.approve_discount')
    if discount.estado != Discount.DiscountStatus.PENDING:
        raise ValidationError('Este descuento ya fue procesado.')

    discount.estado = Discount.DiscountStatus.APPROVED if approve else Discount.DiscountStatus.REJECTED
    discount.decidido_por = user
    discount.decidido_el = timezone.now()
    discount.notas_admin = notas_admin or ''
    discount.save(update_fields=['estado', 'decidido_por', 'decidido_el', 'notas_admin'])

    if approve and discount.ticket_id:
        ticket = discount.ticket
        if discount.tipo_descuento == Discount.DiscountType.PERCENTAGE:
            discount_amount = (ticket.total * discount.respuesta) / Decimal('100')
        else:
            discount_amount = discount.respuesta
        ticket.total = max(Decimal('0.00'), ticket.total - discount_amount)
        ticket.save(update_fields=['total', 'updated_at'])

    log_audit(module='finance', action='APPROVAL', user=user, obj=discount, after_data={'estado': discount.estado})
    return discount


@transaction.atomic
def request_reversal(*, receipt, user, tipo_reversa, motivo):
    require_permission(user, 'finance.request_reversal')
    reversal = PaymentReversal.objects.create(
        receipt=receipt,
        tipo_reversa=tipo_reversa,
        motivo=motivo,
        solicitado_por=user,
    )
    log_audit(module='finance', action='CREATE', user=user, obj=reversal, after_data={'receipt_id': receipt.id, 'tipo_reversa': tipo_reversa})
    return reversal


@transaction.atomic
def decide_reversal(*, reversal, user, approve):
    require_permission(user, 'finance.approve_reversal')
    if reversal.estado != PaymentReversal.ReversalStatus.PENDING:
        raise ValidationError('Esta reversa ya fue procesada.')

    reversal.estado = PaymentReversal.ReversalStatus.APPROVED if approve else PaymentReversal.ReversalStatus.REJECTED
    reversal.aprobado_por = user
    reversal.aprobado_el = timezone.now()
    reversal.save(update_fields=['estado', 'aprobado_por', 'aprobado_el'])

    if approve:
        receipt = reversal.receipt
        for item in receipt.schedule_items.select_related('cuota').all():
            schedule = item.cuota
            schedule.monto_pagado = max(Decimal('0.00'), schedule.monto_pagado - item.monto_aplicado)
            schedule.esta_pagado = schedule.monto_pagado >= schedule.amount
            schedule.pagado_el = timezone.now() if schedule.esta_pagado else None
            schedule.save(update_fields=['monto_pagado', 'esta_pagado', 'pagado_el', 'updated_at'])
        receipt.estado = Receipt.ReceiptStatus.REVERSED
        receipt.save(update_fields=['estado', 'updated_at'])
        if receipt.ticket_id:
            sync_customer_morosidad(receipt.ticket.customer)

    log_audit(module='finance', action='APPROVAL', user=user, obj=reversal, after_data={'estado': reversal.estado})
    return reversal


@transaction.atomic
def generate_storage_charges(*, ticket, through_date=None):
    through_date = through_date or timezone.now().date()
    if ticket.estado not in {'READY', 'STORAGE'}:
        return []

    profile = CompanyProfile.objects.first()
    grace_days = profile.cochera_grace_days if profile else 3
    daily_rate = profile.cochera_daily_rate if profile else Decimal('0.00')
    if daily_rate <= 0:
        return []

    last_ready_transition = ticket.transitions.filter(estado_nuevo__in=['READY', 'STORAGE']).order_by('-created_at').first()
    if not last_ready_transition:
        return []

    start_date = (last_ready_transition.created_at + timezone.timedelta(days=grace_days)).date()
    if start_date > through_date:
        return []

    existing_dates = set(ticket.cochera_charges.values_list('charge_date', flat=True))
    created = []
    current_date = start_date
    while current_date <= through_date:
        if current_date not in existing_dates:
            created.append(
                CocheraCharge.objects.create(
                    ticket=ticket,
                    charge_date=current_date,
                    tarifa_diaria=daily_rate,
                )
            )
        current_date += timezone.timedelta(days=1)
    return created


def update_all_customer_morosidad():
    for customer in Customer.objects.all():
        sync_customer_morosidad(customer)
