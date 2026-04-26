from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from .models import Ticket

@receiver(pre_save, sender=Ticket)
def cache_previous_state(sender, instance, **kwargs):
    if instance.pk:
        try:
            old_instance = Ticket.objects.get(pk=instance.pk)
            instance._old_assigned_to = old_instance.assigned_to
            instance._old_estado = old_instance.estado
        except Ticket.DoesNotExist:
            instance._old_assigned_to = None
            instance._old_estado = None
    else:
        instance._old_assigned_to = None
        instance._old_estado = None

@receiver(post_save, sender=Ticket)
def update_user_active_ticket_count(sender, instance, created, **kwargs):
    inactive_states = [Ticket.TicketStatus.DELIVERED, Ticket.TicketStatus.CLOSED, Ticket.TicketStatus.REJECTED]
    
    if created:
        if instance.assigned_to and instance.estado not in inactive_states:
            user = instance.assigned_to
            user.active_ticket_count += 1
            user.save(update_fields=['active_ticket_count'])
    else:
        old_assigned_to = getattr(instance, '_old_assigned_to', None)
        old_estado = getattr(instance, '_old_estado', None)
        new_assigned_to = instance.assigned_to
        new_estado = instance.estado

        was_active = old_estado not in inactive_states if old_estado else False
        is_active = new_estado not in inactive_states

        if old_assigned_to == new_assigned_to:
            if was_active and not is_active:
                # Ticket closed
                if old_assigned_to:
                    old_assigned_to.active_ticket_count = max(0, old_assigned_to.active_ticket_count - 1)
                    old_assigned_to.save(update_fields=['active_ticket_count'])
            elif not was_active and is_active:
                # Ticket reopened
                if new_assigned_to:
                    new_assigned_to.active_ticket_count += 1
                    new_assigned_to.save(update_fields=['active_ticket_count'])
        else:
            # Assignment changed
            if was_active:
                if old_assigned_to:
                    old_assigned_to.active_ticket_count = max(0, old_assigned_to.active_ticket_count - 1)
                    old_assigned_to.save(update_fields=['active_ticket_count'])
            if is_active:
                if new_assigned_to:
                    new_assigned_to.active_ticket_count += 1
                    new_assigned_to.save(update_fields=['active_ticket_count'])
