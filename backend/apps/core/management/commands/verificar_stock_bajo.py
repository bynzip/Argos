from django.core.management.base import BaseCommand
from django.db.models import F
from django.utils import timezone
from apps.products.models import Product
from apps.core.models import Notification
from apps.users.models import User

class Command(BaseCommand):
    help = 'Verifica si hay productos con stock por debajo del mínimo y genera notificaciones (Idempotente).'

    def handle(self, *args, **kwargs):
        self.stdout.write("Iniciando verificación de stock bajo...")

        # Encuentra productos cuyo stock total es <= stock mínimo
        # Esto es un query simplificado; en un escenario real multialmacén,
        # podríamos agrupar por producto o verificar almacenes específicos.
        low_stock_products = Product.objects.filter(
            stocks__cantidad__lte=F('stock_minimo'),
            activo=True,
            deleted_at__isnull=True
        ).distinct()

        if not low_stock_products.exists():
            self.stdout.write(self.style.SUCCESS("Todos los productos tienen stock suficiente."))
            return

        # Obtenemos los usuarios que deben recibir la notificación (Almaceneros y Administradores)
        # En base a los roles configurados.
        receivers = User.objects.filter(
            user_roles__role__nombre__in=['Almacenero', 'Administrador'],
            is_active=True
        ).distinct()

        created_count = 0
        today = timezone.now().date()

        for product in low_stock_products:
            msg = f"Stock Crítico: {product.nombre} (SKU: {product.codigo}). El stock actual está por debajo del mínimo de {product.stock_minimo}."
            
            for user in receivers:
                # Idempotencia (RN-06/OBS-06): Verificar si este usuario ya recibió esta misma alerta hoy
                already_notified = Notification.objects.filter(
                    user=user,
                    message=msg,
                    created_at__date=today
                ).exists()

                if not already_notified:
                    Notification.objects.create(
                        user=user,
                        message=msg
                    )
                    created_count += 1

        self.stdout.write(self.style.SUCCESS(f"Verificación terminada. {created_count} notificaciones generadas."))
