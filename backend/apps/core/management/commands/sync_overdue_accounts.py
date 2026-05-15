from django.core.management.base import BaseCommand

from apps.finance.services import update_all_customer_morosidad


class Command(BaseCommand):
    help = 'Sincroniza la etiqueta de clientes morosos segun cuotas vencidas.'

    def handle(self, *args, **options):
        update_all_customer_morosidad()
        self.stdout.write(self.style.SUCCESS('Etiquetas de morosidad sincronizadas.'))
