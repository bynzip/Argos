from django.db import transaction
from django.core.exceptions import ValidationError
from apps.core.utils import generate_folio
from apps.tickets.models import Ticket, TicketTransition

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
            
        if new_status == Ticket.TicketStatus.DELIVERED:
            # RN-01: Un ticket no puede entregarse con saldo pendiente
            if ticket.saldo_pendiente > 0:
                raise ValidationError(f"No se puede entregar el equipo. Hay un saldo pendiente de S/ {ticket.saldo_pendiente}.")
                
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
