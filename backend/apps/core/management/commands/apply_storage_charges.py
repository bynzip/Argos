from django.core.management.base import BaseCommand

from apps.finance.services import generate_storage_charges
from apps.tickets.models import Ticket


class Command(BaseCommand):
    help = 'Genera cargos de cochera pendientes para tickets listos o en cochera.'

    def handle(self, *args, **options):
        generated = 0
        for ticket in Ticket.objects.filter(estado__in=['READY', 'STORAGE']):
            generated += len(generate_storage_charges(ticket=ticket))
        self.stdout.write(self.style.SUCCESS(f'Cargos generados: {generated}'))
