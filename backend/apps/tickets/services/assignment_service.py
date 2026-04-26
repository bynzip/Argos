from django.db import transaction
from apps.tickets.models import Ticket

def assign_ticket(ticket, technician, user, motivo=None):
    with transaction.atomic():
        ticket.assigned_to = technician
        ticket.save(update_fields=['assigned_to', 'updated_at'])
        return ticket
