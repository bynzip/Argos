from django.core.management.base import BaseCommand
from django.db.models import DecimalField, ExpressionWrapper, F, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.core.models import Notification
from apps.products.models import Product
from apps.users.models import User


class Command(BaseCommand):
    help = 'Verifica si hay productos con stock disponible por debajo del mínimo y genera notificaciones (Idempotente).'

    def handle(self, *args, **kwargs):
        self.stdout.write('Iniciando verificación de stock bajo...')

        low_stock_products = Product.objects.annotate(
            total_stock_fisico=Coalesce(Sum('stocks__cantidad'), Value(0), output_field=DecimalField(max_digits=12, decimal_places=3)),
            total_stock_reservado=Coalesce(Sum('stocks__reservado'), Value(0), output_field=DecimalField(max_digits=12, decimal_places=3)),
            total_stock_disponible=ExpressionWrapper(
                F('total_stock_fisico') - F('total_stock_reservado'),
                output_field=DecimalField(max_digits=12, decimal_places=3),
            ),
        ).filter(
            total_stock_disponible__lte=F('stock_minimo'),
            activo=True,
            deleted_at__isnull=True,
        ).distinct()

        if not low_stock_products.exists():
            self.stdout.write(self.style.SUCCESS('Todos los productos tienen stock suficiente.'))
            return

        receivers = User.objects.filter(
            user_roles__role__nombre__in=['Almacenero', 'Administrador'],
            is_active=True
        ).distinct()

        created_count = 0
        today = timezone.now().date()

        for product in low_stock_products:
            msg = (
                f'Stock Crítico: {product.nombre} (SKU: {product.codigo}). '
                f'El stock disponible actual está por debajo del mínimo de {product.stock_minimo}.'
            )

            for user in receivers:
                already_notified = Notification.objects.filter(
                    user=user,
                    message=msg,
                    created_at__date=today
                ).exists()

                if not already_notified:
                    Notification.objects.create(user=user, message=msg)
                    created_count += 1

        self.stdout.write(self.style.SUCCESS(f'Verificación terminada. {created_count} notificaciones generadas.'))
