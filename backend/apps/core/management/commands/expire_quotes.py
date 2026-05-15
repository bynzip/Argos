from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.quotes.models import Quote


class Command(BaseCommand):
    help = 'Marca como vencidas las cotizaciones enviadas que ya pasaron su validez.'

    def handle(self, *args, **options):
        today = timezone.now().date()
        updated = Quote.objects.filter(
            estado=Quote.QuoteStatus.SENT,
            valido_hasta__isnull=False,
            valido_hasta__lt=today,
        ).update(estado=Quote.QuoteStatus.EXPIRED, updated_at=timezone.now())
        self.stdout.write(self.style.SUCCESS(f'Cotizaciones vencidas actualizadas: {updated}'))
