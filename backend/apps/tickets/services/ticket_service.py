import json

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.core.utils import generate_folio
from apps.tickets.models import Ticket, TicketTransition
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


def transition_ticket(ticket, new_status, user, motivo=None):
    with transaction.atomic():
        current_status = ticket.estado

        if current_status == new_status:
            return ticket

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

        ticket.estado = new_status
        ticket.save(update_fields=['estado', 'updated_at'])

        TicketTransition.objects.create(
            ticket=ticket,
            estado_anterior=current_status,
            estado_nuevo=new_status,
            cambiado_por=user,
            motivo=motivo
        )

        return ticket


def update_ticket_amounts(ticket, user, monto_estimado=None, total=None, motivo="Actualización de montos"):
    with transaction.atomic():
        update_fields = ['updated_at']
        if monto_estimado is not None:
            ticket.monto_estimado = monto_estimado
            update_fields.append('monto_estimado')
        if total is not None:
            ticket.total = total
            update_fields.append('total')

        if len(update_fields) > 1:
            ticket.save(update_fields=update_fields)

        return ticket
