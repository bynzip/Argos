import json
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from apps.core.models import CompanyProfile
from apps.core.utils import generate_folio
from apps.customers.services import get_or_create_generic_customer
from apps.quotes.models import Quote, QuoteApproval, QuoteAttachment, QuoteLine, QuoteToTicket
from apps.tickets.models import Ticket, TicketTransition
from apps.tickets.services.ticket_service import create_ticket
from apps.users.permissions import require_permission

MONEY_QUANTIZE = Decimal('0.01')


def decimalize(value, field_name):
    try:
        return Decimal(str(value))
    except Exception as exc:
        raise ValidationError({field_name: f"El campo {field_name} tiene un valor invalido."}) from exc


def get_user_role_name(user):
    if getattr(user, 'is_superuser', False):
        return 'Administrador'
    user_role = user.user_roles.select_related('role').first()
    return user_role.role.nombre if user_role else ''


def validate_discount_permissions(*, user, descuento, normalized_lines):
    if get_user_role_name(user) != 'Recepcionista':
        return

    has_line_discount = any(line['descuento_linea'] > 0 for line in normalized_lines)
    if Decimal(str(descuento)) > 0 or has_line_discount:
        raise ValidationError({
            'descuento': 'La recepcionista no puede aplicar descuentos directamente. Usa el flujo de Solicitar descuento.'
        })


def get_company_profile():
    profile = CompanyProfile.objects.first()
    if profile:
        return profile

    class QuoteDefaults:
        quote_default_validity_days = 15
        quote_default_igv = Decimal('18.00')
        quote_approval_threshold_amount = Decimal('1500.00')

    return QuoteDefaults()


def parse_quote_lines_payload(lines_raw):
    if not lines_raw:
        raise ValidationError({'lines': 'Debes agregar al menos una linea a la cotizacion.'})

    if isinstance(lines_raw, str):
        try:
            lines = json.loads(lines_raw)
        except json.JSONDecodeError as exc:
            raise ValidationError({'lines': 'El formato de lineas es invalido.'}) from exc
    else:
        lines = lines_raw

    if not isinstance(lines, list) or not lines:
        raise ValidationError({'lines': 'Las lineas deben enviarse como una lista no vacia.'})

    normalized_lines = []
    for index, line in enumerate(lines):
        if not isinstance(line, dict):
            raise ValidationError({'lines': f'La linea {index + 1} no es valida.'})

        line_type = line.get('line_type')
        if line_type not in [QuoteLine.LineType.PRODUCT, QuoteLine.LineType.SERVICE]:
            raise ValidationError({'lines': f'La linea {index + 1} debe ser PRODUCT o SERVICE.'})

        product_id = line.get('product')
        service_id = line.get('service')
        if line_type == QuoteLine.LineType.PRODUCT and not product_id:
            raise ValidationError({'lines': f'La linea {index + 1} requiere un producto.'})
        if line_type == QuoteLine.LineType.SERVICE and not service_id:
            raise ValidationError({'lines': f'La linea {index + 1} requiere un servicio.'})

        cantidad = decimalize(line.get('cantidad', 1), 'cantidad')
        if cantidad <= 0:
            raise ValidationError({'lines': f'La linea {index + 1} debe tener cantidad mayor a 0.'})
        if cantidad != cantidad.to_integral_value():
            raise ValidationError({'lines': f'La linea {index + 1} debe tener una cantidad entera positiva.'})

        precio_unitario = decimalize(line.get('precio_unitario', 0), 'precio_unitario')
        descuento_linea = decimalize(line.get('descuento_linea', 0), 'descuento_linea')
        if precio_unitario < 0 or descuento_linea < 0:
            raise ValidationError({'lines': f'La linea {index + 1} tiene valores negativos invalidos.'})

        normalized_lines.append({
            'line_type': line_type,
            'product_id': product_id,
            'service_id': service_id,
            'descripcion': (line.get('descripcion') or '').strip(),
            'cantidad': cantidad,
            'precio_unitario': precio_unitario,
            'descuento_linea': descuento_linea,
            'supply_status': line.get('supply_status') or QuoteLine.SupplyStatus.NOT_APPLICABLE,
            'orden': int(line.get('orden', index)),
        })

    return normalized_lines


def quote_requires_amount_approval(quote):
    profile = get_company_profile()
    threshold = Decimal(str(profile.quote_approval_threshold_amount))
    return quote.total > threshold


def quote_has_payment_activity(quote):
    return quote.receipts.exists() or quote.schedules.exists()


def validate_quote_customer_device(*, customer, device, source_ticket=None, quote_type=Quote.QuoteType.REPAIR):
    if source_ticket and customer and source_ticket.customer_id != customer.id:
        raise ValidationError({'customer': 'El ticket asociado pertenece a otro cliente.'})

    if device and customer and device.customer_id != customer.id:
        raise ValidationError({'device': 'El dispositivo seleccionado no pertenece al cliente indicado.'})

    if quote_type == Quote.QuoteType.DIRECT and source_ticket and device and device.customer_id != source_ticket.customer_id:
        raise ValidationError({'device': 'El dispositivo seleccionado no coincide con el ticket asociado.'})


def resolve_quote_context(*, customer=None, device=None, source_ticket=None, quote_type=Quote.QuoteType.REPAIR):
    if source_ticket:
        customer = source_ticket.customer
        if source_ticket.device_id and not device:
            device = source_ticket.device

    if not customer:
        customer = get_or_create_generic_customer()

    validate_quote_customer_device(
        customer=customer,
        device=device,
        source_ticket=source_ticket,
        quote_type=quote_type,
    )
    return customer, device


def calculate_quote_totals(lines, descuento, igv_rate):
    subtotal = Decimal('0.00')
    line_totals = []

    for line in lines:
        total_linea = (line['cantidad'] * line['precio_unitario']) - line['descuento_linea']
        if total_linea < 0:
            raise ValidationError({'lines': 'Una linea no puede quedar con total negativo.'})
        total_linea = total_linea.quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
        line_totals.append(total_linea)
        subtotal += total_linea

    subtotal = subtotal.quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
    descuento = Decimal(str(descuento)).quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
    if descuento < 0:
        raise ValidationError({'descuento': 'El descuento no puede ser negativo.'})
    if descuento > subtotal:
        raise ValidationError({'descuento': 'El descuento no puede superar el subtotal.'})

    taxable_base = (subtotal - descuento).quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
    igv_amount = (taxable_base * Decimal(str(igv_rate)) / Decimal('100')).quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
    total = (taxable_base + igv_amount).quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
    return subtotal, igv_amount, total, line_totals


def resolve_line_relations(line_data):
    from apps.products.models import Product
    from apps.services.models import Service

    product = None
    service = None
    if line_data['line_type'] == QuoteLine.LineType.PRODUCT:
        try:
            product = Product.objects.get(pk=line_data['product_id'])
        except Product.DoesNotExist as exc:
            raise ValidationError({'lines': 'Uno de los productos seleccionados no existe.'}) from exc
    else:
        try:
            service = Service.objects.get(pk=line_data['service_id'])
        except Service.DoesNotExist as exc:
            raise ValidationError({'lines': 'Uno de los servicios seleccionados no existe.'}) from exc

    descripcion = line_data['descripcion'] or (product.nombre if product else service.nombre)
    supply_status = line_data['supply_status']
    if line_data['line_type'] == QuoteLine.LineType.SERVICE:
        supply_status = QuoteLine.SupplyStatus.NOT_APPLICABLE

    return product, service, descripcion, supply_status


def sync_amount_approval_for_quote(quote):
    approval = quote.approvals.filter(approval_type=QuoteApproval.ApprovalType.AMOUNT).order_by('-created_at').first()
    requires_approval = quote_requires_amount_approval(quote)

    if requires_approval and (not approval or approval.estado == QuoteApproval.ApprovalStatus.REJECTED):
        QuoteApproval.objects.create(
            quote=quote,
            approval_type=QuoteApproval.ApprovalType.AMOUNT,
            required_level=QuoteApproval.ApprovalLevel.ADMIN,
            estado=QuoteApproval.ApprovalStatus.PENDING,
        )

    if not requires_approval:
        quote.approvals.filter(
            approval_type=QuoteApproval.ApprovalType.AMOUNT,
            estado=QuoteApproval.ApprovalStatus.PENDING,
        ).delete()


def update_linked_ticket_from_quote(quote, new_status, user, motivo):
    ticket = quote.source_ticket
    if not ticket:
        return

    current_status = ticket.estado
    if current_status == new_status:
        return

    ticket.estado = new_status
    update_fields = ['estado', 'updated_at']

    if new_status == Ticket.TicketStatus.QUOTED:
        ticket.monto_estimado = quote.total
        update_fields.append('monto_estimado')
    elif new_status == Ticket.TicketStatus.APPROVED:
        ticket.monto_estimado = quote.total
        ticket.monto_aprobado = quote.total
        ticket.total = quote.total
        update_fields.extend(['monto_estimado', 'monto_aprobado', 'total'])
    elif new_status == Ticket.TicketStatus.REJECTED:
        try:
            from apps.products.services import release_ticket_reservations
            release_ticket_reservations(ticket=ticket, user=user, reason='Liberacion automatica por rechazo de cotizacion')
        except Exception:
            pass
        ticket.monto_aprobado = None
        ticket.total = Decimal('0.00')
        update_fields.extend(['monto_aprobado', 'total'])

    ticket.save(update_fields=update_fields)
    TicketTransition.objects.create(
        ticket=ticket,
        estado_anterior=current_status,
        estado_nuevo=new_status,
        cambiado_por=user,
        motivo=motivo,
    )


def create_quote_attachments(quote, files, user):
    for file_obj in files:
        QuoteAttachment.objects.create(
            quote=quote,
            archivo=file_obj,
            nombre_archivo=file_obj.name,
            tamano_archivo=file_obj.size,
            subido_por=user,
        )


def create_quote_lines(quote, normalized_lines):
    subtotal, igv_amount, total, line_totals = calculate_quote_totals(
        normalized_lines,
        quote.descuento,
        quote.igv_rate,
    )

    for line_data, total_linea in zip(normalized_lines, line_totals):
        product, service, descripcion, supply_status = resolve_line_relations(line_data)
        QuoteLine.objects.create(
            quote=quote,
            line_type=line_data['line_type'],
            product=product,
            service=service,
            descripcion=descripcion,
            cantidad=line_data['cantidad'],
            precio_unitario=line_data['precio_unitario'],
            descuento_linea=line_data['descuento_linea'],
            total_linea=total_linea,
            supply_status=supply_status,
            orden=line_data['orden'],
        )

    quote.subtotal = subtotal
    quote.igv_amount = igv_amount
    quote.total = total
    quote.save(update_fields=['subtotal', 'igv_amount', 'total', 'updated_at'])
    sync_amount_approval_for_quote(quote)


@transaction.atomic
def create_quote(
    *,
    user,
    customer=None,
    device=None,
    source_ticket=None,
    quote_type=Quote.QuoteType.REPAIR,
    lines=None,
    descuento=0,
    igv_rate=None,
    valido_hasta=None,
    notas='',
    attachments=None,
):
    profile = get_company_profile()
    customer, device = resolve_quote_context(
        customer=customer,
        device=device,
        source_ticket=source_ticket,
        quote_type=quote_type,
    )

    if igv_rate is None:
        igv_rate = profile.quote_default_igv
    if not valido_hasta:
        valido_hasta = timezone.localdate() + timedelta(days=int(profile.quote_default_validity_days))

    quote = Quote.objects.create(
        folio=generate_folio('COT'),
        version=1,
        base_quote=None,
        customer=customer,
        device=device,
        source_ticket=source_ticket,
        created_by=user,
        quote_type=quote_type,
        descuento=decimalize(descuento, 'descuento'),
        igv_rate=decimalize(igv_rate, 'igv_rate'),
        valido_hasta=valido_hasta,
        notas=notas,
    )
    quote.base_quote = quote
    quote.save(update_fields=['base_quote'])

    normalized_lines = parse_quote_lines_payload(lines)
    validate_discount_permissions(user=user, descuento=descuento, normalized_lines=normalized_lines)
    create_quote_lines(quote, normalized_lines)
    create_quote_attachments(quote, attachments or [], user)
    return quote


@transaction.atomic
def update_quote(
    *,
    quote,
    user,
    customer=None,
    device=None,
    source_ticket=None,
    quote_type=None,
    lines=None,
    descuento=None,
    igv_rate=None,
    valido_hasta=None,
    notas=None,
    attachments=None,
):
    if quote.estado != Quote.QuoteStatus.DRAFT:
        raise ValidationError({'detail': 'Solo se pueden editar cotizaciones en borrador.'})
    if not quote.is_active_version:
        raise ValidationError({'detail': 'Solo la version activa mas reciente puede editarse.'})
    if quote_has_payment_activity(quote):
        raise ValidationError({'detail': 'La cotizacion ya tiene actividad de cobro y no puede editarse.'})

    normalized_lines = None
    if lines is not None:
        normalized_lines = parse_quote_lines_payload(lines)

    next_discount = quote.descuento if descuento is None else decimalize(descuento, 'descuento')
    validate_discount_permissions(
        user=user,
        descuento=next_discount,
        normalized_lines=normalized_lines or [
            {'descuento_linea': line.descuento_linea}
            for line in quote.lines.all()
        ],
    )

    next_quote_type = quote_type or quote.quote_type
    next_customer = customer or quote.customer
    next_device = device if device is not None else quote.device
    next_source_ticket = source_ticket if source_ticket is not None else quote.source_ticket
    next_customer, next_device = resolve_quote_context(
        customer=next_customer,
        device=next_device,
        source_ticket=next_source_ticket,
        quote_type=next_quote_type,
    )

    quote.customer = next_customer
    quote.device = next_device
    quote.source_ticket = next_source_ticket
    quote.quote_type = next_quote_type

    if descuento is not None:
        quote.descuento = next_discount
    if igv_rate is not None:
        quote.igv_rate = decimalize(igv_rate, 'igv_rate')
    if valido_hasta is not None:
        quote.valido_hasta = valido_hasta
    if notas is not None:
        quote.notas = notas
    quote.save()

    if normalized_lines is not None:
        quote.lines.all().delete()
        create_quote_lines(quote, normalized_lines)

    create_quote_attachments(quote, attachments or [], user)
    return quote


@transaction.atomic
def send_quote(*, quote, user):
    if quote.estado != Quote.QuoteStatus.DRAFT:
        raise ValidationError({'detail': 'Solo se pueden enviar cotizaciones en borrador.'})
    if not quote.is_active_version:
        raise ValidationError({'detail': 'Solo la version activa mas reciente puede enviarse.'})

    latest_amount_approval = quote.approvals.filter(
        approval_type=QuoteApproval.ApprovalType.AMOUNT
    ).order_by('-created_at').first()

    if quote_requires_amount_approval(quote):
        if not latest_amount_approval or latest_amount_approval.estado != QuoteApproval.ApprovalStatus.APPROVED:
            raise ValidationError({'detail': 'La cotizacion requiere aprobacion administrativa antes de enviarse.'})

    quote.estado = Quote.QuoteStatus.SENT
    quote.save(update_fields=['estado', 'updated_at'])
    update_linked_ticket_from_quote(quote, Ticket.TicketStatus.QUOTED, user, 'Cotizacion enviada al cliente')
    return quote


@transaction.atomic
def approve_amount_approval(*, quote, user, notas=''):
    require_permission(user, 'quotes.approve_multinivel')
    approval = quote.approvals.filter(
        approval_type=QuoteApproval.ApprovalType.AMOUNT,
        estado=QuoteApproval.ApprovalStatus.PENDING,
    ).order_by('-created_at').first()
    if not approval:
        raise ValidationError({'detail': 'La cotizacion no tiene aprobacion pendiente por monto.'})

    approval.estado = QuoteApproval.ApprovalStatus.APPROVED
    approval.decidido_por = user
    approval.decidido_el = timezone.now()
    approval.notas = notas
    approval.save(update_fields=['estado', 'decidido_por', 'decidido_el', 'notas'])
    return approval


@transaction.atomic
def reject_amount_approval(*, quote, user, notas=''):
    require_permission(user, 'quotes.approve_multinivel')
    approval = quote.approvals.filter(
        approval_type=QuoteApproval.ApprovalType.AMOUNT,
        estado=QuoteApproval.ApprovalStatus.PENDING,
    ).order_by('-created_at').first()
    if not approval:
        raise ValidationError({'detail': 'La cotizacion no tiene aprobacion pendiente por monto.'})

    approval.estado = QuoteApproval.ApprovalStatus.REJECTED
    approval.decidido_por = user
    approval.decidido_el = timezone.now()
    approval.notas = notas
    approval.save(update_fields=['estado', 'decidido_por', 'decidido_el', 'notas'])
    return approval


@transaction.atomic
def approve_quote(*, quote, user):
    if quote.estado != Quote.QuoteStatus.SENT:
        raise ValidationError({'detail': 'Solo se pueden aprobar cotizaciones enviadas.'})
    if not quote.is_active_version:
        raise ValidationError({'detail': 'Solo la version activa mas reciente puede aprobarse.'})

    quote.estado = Quote.QuoteStatus.APPROVED
    quote.save(update_fields=['estado', 'updated_at'])
    update_linked_ticket_from_quote(quote, Ticket.TicketStatus.APPROVED, user, 'Cliente aprobo la cotizacion')
    return quote


@transaction.atomic
def reject_quote(*, quote, user, motivo=''):
    if quote.estado != Quote.QuoteStatus.SENT:
        raise ValidationError({'detail': 'Solo se pueden rechazar cotizaciones enviadas.'})
    if not quote.is_active_version:
        raise ValidationError({'detail': 'Solo la version activa mas reciente puede rechazarse.'})

    quote.estado = Quote.QuoteStatus.REJECTED
    quote.save(update_fields=['estado', 'updated_at'])
    update_linked_ticket_from_quote(quote, Ticket.TicketStatus.REJECTED, user, motivo or 'Cliente rechazo la cotizacion')
    return quote


@transaction.atomic
def create_quote_version(*, quote, user):
    if not quote.is_active_version:
        raise ValidationError({'detail': 'Solo la version activa mas reciente puede versionarse.'})
    if quote.estado not in [Quote.QuoteStatus.DRAFT, Quote.QuoteStatus.SENT, Quote.QuoteStatus.APPROVED, Quote.QuoteStatus.REJECTED]:
        raise ValidationError({'detail': 'La cotizacion no puede versionarse en su estado actual.'})
    if quote_has_payment_activity(quote):
        raise ValidationError({'detail': 'La cotizacion ya tiene actividad de cobro y no puede versionarse.'})

    root_quote = quote.base_quote or quote
    next_version = (Quote.objects.filter(folio=root_quote.folio).aggregate(max_version=models.Max('version'))['max_version'] or 0) + 1
    Quote.objects.filter(folio=root_quote.folio, is_active_version=True).update(is_active_version=False)

    new_quote = Quote.objects.create(
        folio=root_quote.folio,
        version=next_version,
        base_quote=root_quote,
        customer=quote.customer,
        device=quote.device,
        source_ticket=quote.source_ticket,
        created_by=user,
        quote_type=quote.quote_type,
        estado=Quote.QuoteStatus.DRAFT,
        subtotal=quote.subtotal,
        igv_rate=quote.igv_rate,
        igv_amount=quote.igv_amount,
        descuento=quote.descuento,
        total=quote.total,
        valido_hasta=quote.valido_hasta,
        notas=quote.notas,
        is_active_version=True,
    )

    for line in quote.lines.all():
        QuoteLine.objects.create(
            quote=new_quote,
            line_type=line.line_type,
            product=line.product,
            service=line.service,
            descripcion=line.descripcion,
            cantidad=line.cantidad,
            precio_unitario=line.precio_unitario,
            descuento_linea=line.descuento_linea,
            total_linea=line.total_linea,
            supply_status=line.supply_status,
            orden=line.orden,
        )

    for attachment in quote.attachments.all():
        QuoteAttachment.objects.create(
            quote=new_quote,
            archivo=attachment.archivo.name,
            nombre_archivo=attachment.nombre_archivo,
            tamano_archivo=attachment.tamano_archivo,
            subido_por=user,
        )

    sync_amount_approval_for_quote(new_quote)
    return new_quote


@transaction.atomic
def convert_quote_to_ticket(*, quote, user):
    if quote.source_ticket_id:
        raise ValidationError({'detail': 'Las cotizaciones ligadas a un ticket existente no generan un ticket nuevo.'})
    if quote.estado != Quote.QuoteStatus.APPROVED:
        raise ValidationError({'detail': 'Solo se pueden convertir cotizaciones aprobadas.'})
    if not quote.is_active_version:
        raise ValidationError({'detail': 'Solo la version activa mas reciente puede convertirse.'})

    ticket = create_ticket(
        customer=quote.customer,
        user=user,
        descripcion_problema=quote.notas or f'Ticket generado desde cotizacion {quote.folio}',
        device=quote.device,
        prioridad=Ticket.TicketPriority.MEDIUM,
    )
    previous_status = ticket.estado
    ticket.estado = Ticket.TicketStatus.APPROVED
    ticket.monto_estimado = quote.total
    ticket.monto_aprobado = quote.total
    ticket.total = quote.total
    ticket.save(update_fields=['estado', 'monto_estimado', 'monto_aprobado', 'total', 'updated_at'])

    TicketTransition.objects.create(
        ticket=ticket,
        estado_anterior=previous_status,
        estado_nuevo=Ticket.TicketStatus.APPROVED,
        cambiado_por=user,
        motivo=f'Ticket creado desde cotizacion {quote.folio}',
    )

    quote.source_ticket = ticket
    quote.quote_type = Quote.QuoteType.REPAIR
    quote.estado = Quote.QuoteStatus.CONVERTED
    quote.save(update_fields=['source_ticket', 'quote_type', 'estado', 'updated_at'])
    QuoteToTicket.objects.create(quote=quote, ticket=ticket, convertido_por=user)
    return ticket


def get_active_ticket_quote(ticket):
    return ticket.quotes.filter(is_active_version=True).order_by('-version').first()


@transaction.atomic
def create_quick_quote_for_ticket(
    *,
    ticket,
    user,
    lines,
    descuento=0,
    igv_rate=None,
):
    require_permission(user, 'quotes.create')

    if ticket.quotes.exists():
        raise ValidationError({'detail': 'Este ticket ya tiene una cotizacion ligada. Usa el flujo normal de cotizaciones.'})

    quote = create_quote(
        user=user,
        customer=ticket.customer,
        device=ticket.device,
        source_ticket=ticket,
        quote_type=Quote.QuoteType.REPAIR,
        lines=lines,
        descuento=descuento,
        igv_rate=igv_rate,
        notas='',
        attachments=[],
    )

    if quote_requires_amount_approval(quote):
        threshold = Decimal(str(get_company_profile().quote_approval_threshold_amount)).quantize(
            MONEY_QUANTIZE,
            rounding=ROUND_HALF_UP,
        )
        raise ValidationError({
            'detail': (
                f'El total rapido supera el umbral de aprobacion (S/ {threshold}). '
                'Usa la cotizacion formal para continuar.'
            )
        })

    quote.estado = Quote.QuoteStatus.APPROVED
    quote.save(update_fields=['estado', 'updated_at'])
    update_linked_ticket_from_quote(quote, Ticket.TicketStatus.APPROVED, user, 'Monto asignado desde flujo rapido')
    return quote
