import json

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.core.audit import log_audit
from apps.core.utils import generate_folio
from apps.tickets.models import Ticket, TicketChecklistEvidence, TicketChecklistItem, TicketSubareaMovement, TicketTransition
from apps.users.permissions import require_permission

MAX_EVIDENCE_FILES = 15
MAX_EVIDENCE_SIZE_BYTES = 5 * 1024 * 1024
ALLOWED_EVIDENCE_CONTENT_TYPES = {'image/jpeg', 'image/png'}

VALID_TRANSITIONS = {
    Ticket.TicketStatus.INTAKE: [Ticket.TicketStatus.DIAGNOSTIC],
    Ticket.TicketStatus.DIAGNOSTIC: [Ticket.TicketStatus.QUOTED, Ticket.TicketStatus.IN_REPAIR],
    Ticket.TicketStatus.QUOTED: [Ticket.TicketStatus.APPROVED, Ticket.TicketStatus.REJECTED],
    Ticket.TicketStatus.APPROVED: [Ticket.TicketStatus.WAITING_PARTS, Ticket.TicketStatus.IN_REPAIR],
    Ticket.TicketStatus.WAITING_PARTS: [Ticket.TicketStatus.IN_REPAIR],
    Ticket.TicketStatus.IN_REPAIR: [Ticket.TicketStatus.IN_TESTING, Ticket.TicketStatus.DIAGNOSTIC],
    Ticket.TicketStatus.IN_TESTING: [Ticket.TicketStatus.READY],
    Ticket.TicketStatus.READY: [Ticket.TicketStatus.DELIVERED, Ticket.TicketStatus.STORAGE],
    Ticket.TicketStatus.STORAGE: [Ticket.TicketStatus.DELIVERED],
    Ticket.TicketStatus.DELIVERED: [Ticket.TicketStatus.CLOSED],
    Ticket.TicketStatus.REJECTED: [Ticket.TicketStatus.DELIVERED],
}

TECHNICAL_STATUSES = {
    Ticket.TicketStatus.DIAGNOSTIC,
    Ticket.TicketStatus.QUOTED,
    Ticket.TicketStatus.APPROVED,
    Ticket.TicketStatus.WAITING_PARTS,
    Ticket.TicketStatus.IN_REPAIR,
    Ticket.TicketStatus.IN_TESTING,
    Ticket.TicketStatus.READY,
    Ticket.TicketStatus.REJECTED,
}

RECEPTION_STATUSES = {
    Ticket.TicketStatus.DELIVERED,
    Ticket.TicketStatus.CLOSED,
    Ticket.TicketStatus.STORAGE,
}


def validate_ticket_device_customer(customer, device):
    if device and device.customer_id != customer.id:
        raise ValidationError("El dispositivo seleccionado no pertenece al cliente indicado.")


def parse_accessories_payload(accessories_raw):
    if not accessories_raw:
        return []

    if isinstance(accessories_raw, str):
        try:
            accessories = json.loads(accessories_raw)
        except json.JSONDecodeError as exc:
            raise ValidationError("El formato de accesorios es inválido.") from exc
    else:
        accessories = accessories_raw

    if not isinstance(accessories, list):
        raise ValidationError("Los accesorios deben enviarse como una lista.")

    normalized_accessories = []
    for accessory in accessories:
        if not isinstance(accessory, dict):
            raise ValidationError("Cada accesorio debe ser un objeto válido.")

        nombre = (accessory.get('nombre') or '').strip()
        if not nombre:
            raise ValidationError("Cada accesorio debe incluir un nombre.")

        normalized_accessories.append({
            'nombre': nombre,
            'condicion': accessory.get('condicion'),
            'notas': accessory.get('notas'),
        })

    return normalized_accessories


def validate_evidence_files(files):
    if len(files) > MAX_EVIDENCE_FILES:
        raise ValidationError(f"Solo puedes subir hasta {MAX_EVIDENCE_FILES} evidencias por ticket.")

    for file_obj in files:
        if file_obj.content_type not in ALLOWED_EVIDENCE_CONTENT_TYPES:
            raise ValidationError("Las evidencias deben ser archivos JPG o PNG.")
        if file_obj.size > MAX_EVIDENCE_SIZE_BYTES:
            raise ValidationError("Cada evidencia debe pesar como máximo 5 MB.")


def create_ticket(customer, user, descripcion_problema, device=None, prioridad=Ticket.TicketPriority.LOW, **kwargs):
    with transaction.atomic():
        folio = generate_folio('TKT')

        ticket = Ticket.objects.create(
            folio=folio,
            customer=customer,
            device=device,
            descripcion_problema=descripcion_problema,
            prioridad=prioridad,
            created_by=user,
            estado=Ticket.TicketStatus.INTAKE,
            **kwargs
        )

        TicketTransition.objects.create(
            ticket=ticket,
            estado_anterior=None,
            estado_nuevo=Ticket.TicketStatus.INTAKE,
            cambiado_por=user,
            motivo="Ticket creado"
        )

        return ticket


def has_pending_required_checklist(ticket):
    return ticket.checklist_items.filter(requerido=True, completado=False).exists()


def transition_ticket(ticket, new_status, user, motivo=None):
    with transaction.atomic():
        try:
            from apps.products.services import ticket_has_active_reservations
        except ImportError:
            ticket_has_active_reservations = None

        current_status = ticket.estado

        if current_status == new_status:
            return ticket

        if new_status in {
            Ticket.TicketStatus.QUOTED,
            Ticket.TicketStatus.APPROVED,
            Ticket.TicketStatus.REJECTED,
        }:
            raise ValidationError(
                "Los estados de cotización se gestionan desde el módulo de cotizaciones."
            )

        allowed_statuses = VALID_TRANSITIONS.get(current_status, [])
        if new_status not in allowed_statuses:
            raise ValidationError(f"No se permite transicionar de {current_status} a {new_status}")

        if new_status in TECHNICAL_STATUSES:
            require_permission(user, 'tickets.transition_technical')
        elif new_status in RECEPTION_STATUSES:
            require_permission(user, 'tickets.transition_reception')

        if new_status == Ticket.TicketStatus.DELIVERED and ticket.saldo_pendiente > 0:
            raise ValidationError(
                f"No se puede entregar el equipo. Hay un saldo pendiente de S/ {ticket.saldo_pendiente}."
            )

        if new_status == Ticket.TicketStatus.READY and has_pending_required_checklist(ticket):
            raise ValidationError(
                "No se puede marcar como listo. Aun faltan items obligatorios del checklist post-servicio."
            )

        if (
            new_status in {Ticket.TicketStatus.DELIVERED, Ticket.TicketStatus.CLOSED}
            and ticket_has_active_reservations
            and ticket_has_active_reservations(ticket)
        ):
            raise ValidationError(
                "Este ticket todavía tiene reservas activas. Debes consumirlas o liberarlas antes de cerrarlo."
            )

        ticket.estado = new_status
        ticket.save(update_fields=['estado', 'updated_at'])

        TicketTransition.objects.create(
            ticket=ticket,
            estado_anterior=current_status,
            estado_nuevo=new_status,
            cambiado_por=user,
            motivo=motivo
        )
        log_audit(module='tickets', action='STATUS_CHANGE', user=user, obj=ticket, before_data={'estado': current_status}, after_data={'estado': new_status})

        return ticket


def update_ticket_amounts(ticket, user, monto_estimado=None, total=None, motivo="Actualización de montos"):
    with transaction.atomic():
        try:
            from apps.quotes.services import get_active_ticket_quote
        except ImportError:
            get_active_ticket_quote = None

        if get_active_ticket_quote and get_active_ticket_quote(ticket):
            raise ValidationError(
                "Este ticket tiene una cotización activa. Los montos deben actualizarse desde la cotización."
            )

        update_fields = ['updated_at']
        if monto_estimado is not None:
            ticket.monto_estimado = monto_estimado
            update_fields.append('monto_estimado')
        if total is not None:
            ticket.total = total
            update_fields.append('total')

        if len(update_fields) > 1:
            ticket.save(update_fields=update_fields)
            log_audit(module='tickets', action='UPDATE', user=user, obj=ticket, after_data={'monto_estimado': str(ticket.monto_estimado), 'total': str(ticket.total)})

        return ticket


@transaction.atomic
def update_ticket_technical_details(*, ticket, user, diagnostico=None, solucion=None):
    require_permission(user, 'tickets.transition_technical')
    update_fields = ['updated_at']
    before_data = {'diagnostico': ticket.diagnostico, 'solucion': ticket.solucion}

    if diagnostico is not None:
        ticket.diagnostico = diagnostico
        update_fields.append('diagnostico')
    if solucion is not None:
        ticket.solucion = solucion
        update_fields.append('solucion')

    ticket.save(update_fields=update_fields)
    log_audit(
        module='tickets',
        action='UPDATE',
        user=user,
        obj=ticket,
        before_data=before_data,
        after_data={'diagnostico': ticket.diagnostico, 'solucion': ticket.solucion},
    )
    return ticket


@transaction.atomic
def create_checklist_item(*, ticket, user, nombre, requerido=True, notas='', orden=0, evidence_files=None):
    require_permission(user, 'tickets.transition_technical')
    item = TicketChecklistItem.objects.create(
        ticket=ticket,
        nombre=nombre.strip(),
        requerido=requerido,
        notas=notas or '',
        orden=orden or 0,
    )
    for file_obj in evidence_files or []:
        TicketChecklistEvidence.objects.create(
            checklist_item=item,
            archivo=file_obj,
            nombre_archivo=file_obj.name,
            subido_por=user,
        )
    log_audit(module='tickets', action='CREATE', user=user, obj=item, after_data={'ticket_id': str(ticket.id), 'nombre': item.nombre})
    return item


@transaction.atomic
def update_checklist_item(*, checklist_item, user, completado=None, notas=None, evidence_files=None):
    require_permission(user, 'tickets.transition_technical')
    update_fields = ['updated_at']

    if completado is not None:
        checklist_item.completado = bool(completado)
        checklist_item.completado_por = user if checklist_item.completado else None
        checklist_item.completado_el = timezone.now() if checklist_item.completado else None
        update_fields.extend(['completado', 'completado_por', 'completado_el'])
    if notas is not None:
        checklist_item.notas = notas
        update_fields.append('notas')

    checklist_item.save(update_fields=update_fields)
    for file_obj in evidence_files or []:
        TicketChecklistEvidence.objects.create(
            checklist_item=checklist_item,
            archivo=file_obj,
            nombre_archivo=file_obj.name,
            subido_por=user,
        )
    log_audit(module='tickets', action='UPDATE', user=user, obj=checklist_item, after_data={'completado': checklist_item.completado, 'notas': checklist_item.notas})
    return checklist_item


@transaction.atomic
def move_ticket_subarea(*, ticket, subarea, user, notas=''):
    require_permission(user, 'tickets.transition_technical')
    previous_subarea = ticket.subarea
    ticket.subarea = subarea
    ticket.save(update_fields=['subarea', 'updated_at'])
    movement = TicketSubareaMovement.objects.create(
        ticket=ticket,
        subarea_origen=previous_subarea,
        subarea_destino=subarea,
        movido_por=user,
        notas=notas or '',
    )
    log_audit(
        module='tickets',
        action='STATUS_CHANGE',
        user=user,
        obj=movement,
        before_data={'subarea_origen': previous_subarea_id(previous_subarea)},
        after_data={'subarea_destino': previous_subarea_id(subarea)},
    )
    return movement


def previous_subarea_id(subarea):
    return subarea.id if subarea else None


@transaction.atomic
def create_warranty_ticket(*, source_ticket, user, descripcion_problema, prioridad=None):
    require_permission(user, 'tickets.create')
    warranty_ticket = create_ticket(
        customer=source_ticket.customer,
        user=user,
        descripcion_problema=descripcion_problema,
        device=source_ticket.device,
        prioridad=prioridad or source_ticket.prioridad,
        ticket_padre=source_ticket,
        es_garantia=True,
        assigned_to=source_ticket.assigned_to,
        subarea=source_ticket.subarea,
    )
    log_audit(module='tickets', action='CREATE', user=user, obj=warranty_ticket, after_data={'ticket_padre_id': str(source_ticket.id), 'es_garantia': True})
    return warranty_ticket
