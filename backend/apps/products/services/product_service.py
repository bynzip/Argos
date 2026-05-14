from django.db import transaction

from apps.core.models import FolioCounter
from apps.products.models import Product, StockItem, Warehouse


def create_product(data, initial_stock=0):
    with transaction.atomic():
        codigo = data.get('codigo')
        if not codigo:
            codigo = FolioCounter.get_next_folio('PROD')

        product = Product.objects.create(
            codigo=codigo,
            nombre=data.get('nombre'),
            category=data.get('category'),
            brand=data.get('brand'),
            descripcion=data.get('descripcion', ''),
            precio_costo=data.get('precio_costo', 0.0),
            precio_venta=data.get('precio_venta', 0.0),
            stock_minimo=data.get('stock_minimo', 0),
            activo=data.get('activo', True)
        )

        if initial_stock > 0:
            warehouse, _ = Warehouse.objects.get_or_create(
                nombre="Almacén Principal",
                defaults={"ubicacion": "Sede Central"}
            )
            StockItem.objects.create(
                product=product,
                warehouse=warehouse,
                cantidad=initial_stock
            )

        return product
