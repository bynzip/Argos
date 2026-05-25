from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.core.audit import log_audit
from apps.core.utils import generate_folio
from apps.products.models import InventoryMovement, Product, StockItem
from apps.products.services.inventory_service import COST_QUANTIZE, MONEY_QUANTIZE, QTY_QUANTIZE, get_or_create_stock_item, record_inventory_movement

from .models import PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatusHistory, Supplier


def _decimalize(value, field='value', quantize=QTY_QUANTIZE):
    try:
        return Decimal(str(value)).quantize(quantize, rounding=ROUND_HALF_UP)
    except Exception as exc:
        raise ValidationError({field: 'Valor invalido.'}) from exc


def _normalize_serial_numbers(*, serial_numbers, expected_quantity, product_name):
    if serial_numbers is None:
        raise ValidationError({
            'serial_numbers': f'Debes registrar los números de serie para {product_name}.'
        })

    normalized = [str(serial).strip() for serial in serial_numbers if str(serial).strip()]
    expected_count = int(expected_quantity)
    if Decimal(expected_count) != expected_quantity:
        raise ValidationError({
            'cantidad_recibida': f'La cantidad recibida de {product_name} debe ser un número entero para registrar series.'
        })
    if len(normalized) != expected_count:
        raise ValidationError({
            'serial_numbers': (
                f'Debes registrar exactamente {expected_count} números de serie para {product_name}.'
            )
        })
    if len(set(normalized)) != len(normalized):
        raise ValidationError({'serial_numbers': 'No se pueden repetir números de serie en la misma recepción.'})
    return normalized


def _recalculate_po_subtotal(purchase_order):
    subtotal = purchase_order.items.aggregate(
        total=Sum(F('cantidad_pedida') * F('precio_unitario'))
    )['total'] or Decimal('0.00')
    purchase_order.subtotal = Decimal(subtotal).quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
    purchase_order.save(update_fields=['subtotal', 'updated_at'])
    return purchase_order


def _sync_purchase_order_items(*, purchase_order, items):
    if not items:
        raise ValidationError({'items': 'Debes agregar al menos un item.'})

    existing_items = {item.id: item for item in purchase_order.items.select_for_update()}
    kept_item_ids = set()

    for item in items:
        item_id = item.get('id')
        product = Product.objects.get(pk=item['product'])
        cantidad_pedida = _decimalize(item['cantidad_pedida'], 'cantidad_pedida')
        precio_unitario = _decimalize(item['precio_unitario'], 'precio_unitario', MONEY_QUANTIZE)

        if item_id:
            po_item = existing_items.get(item_id)
            if not po_item:
                raise ValidationError({'items': f'El item {item_id} no pertenece a esta orden.'})
            if po_item.cantidad_recibida > cantidad_pedida:
                raise ValidationError({
                    'cantidad_pedida': (
                        f'La cantidad pedida de {product.nombre} no puede ser menor '
                        f'a lo ya recibido ({po_item.cantidad_recibida}).'
                    )
                })

            po_item.product = product
            po_item.cantidad_pedida = cantidad_pedida
            po_item.precio_unitario = precio_unitario
            po_item.save(update_fields=['product', 'cantidad_pedida', 'precio_unitario'])
            kept_item_ids.add(po_item.id)
            continue

        po_item = PurchaseOrderItem.objects.create(
            purchase_order=purchase_order,
            product=product,
            cantidad_pedida=cantidad_pedida,
            precio_unitario=precio_unitario,
        )
        kept_item_ids.add(po_item.id)

    removable_items = [item for item_id, item in existing_items.items() if item_id not in kept_item_ids]
    for item in removable_items:
        if item.cantidad_recibida > 0:
            raise ValidationError({
                'items': f'No puedes quitar {item.product.nombre} porque ya tiene recepciones registradas.'
            })
        item.delete()


@transaction.atomic
def create_supplier_order(*, user, supplier, destination_warehouse, items, notes=''):
    purchase_order = PurchaseOrder.objects.create(
        folio=generate_folio('PO'),
        supplier=supplier,
        destination_warehouse=destination_warehouse,
        notes=notes or '',
        created_by=user,
    )

    _sync_purchase_order_items(purchase_order=purchase_order, items=items)
    _recalculate_po_subtotal(purchase_order)
    PurchaseOrderStatusHistory.objects.create(
        purchase_order=purchase_order,
        estado_nuevo=PurchaseOrder.Status.DRAFT,
        cambiado_por=user,
        motivo='Orden creada',
    )
    log_audit(module='suppliers', action='CREATE', user=user, obj=purchase_order, after_data={'estado': purchase_order.estado})
    return purchase_order


@transaction.atomic
def update_supplier_order(*, purchase_order, user, supplier, destination_warehouse, items, notes=''):
    if purchase_order.estado != PurchaseOrder.Status.DRAFT:
        raise ValidationError({'detail': 'Solo se pueden editar ordenes en borrador.'})

    purchase_order.supplier = supplier
    purchase_order.destination_warehouse = destination_warehouse
    purchase_order.notes = notes or ''
    purchase_order.save(update_fields=['supplier', 'destination_warehouse', 'notes', 'updated_at'])

    _sync_purchase_order_items(purchase_order=purchase_order, items=items)
    _recalculate_po_subtotal(purchase_order)

    log_audit(
        module='suppliers',
        action='UPDATE',
        user=user,
        obj=purchase_order,
        after_data={'estado': purchase_order.estado},
    )
    return purchase_order


@transaction.atomic
def send_purchase_order(*, purchase_order, user, notes=''):
    if purchase_order.estado != PurchaseOrder.Status.DRAFT:
        raise ValidationError({'detail': 'Solo se pueden enviar ordenes en borrador.'})

    previous = purchase_order.estado
    purchase_order.estado = PurchaseOrder.Status.SENT
    purchase_order.sent_at = timezone.now()
    purchase_order.save(update_fields=['estado', 'sent_at', 'updated_at'])
    PurchaseOrderStatusHistory.objects.create(
        purchase_order=purchase_order,
        estado_anterior=previous,
        estado_nuevo=purchase_order.estado,
        cambiado_por=user,
        motivo=notes or 'Orden enviada',
    )
    log_audit(module='suppliers', action='STATUS_CHANGE', user=user, obj=purchase_order, before_data={'estado': previous}, after_data={'estado': purchase_order.estado})
    return purchase_order


@transaction.atomic
def cancel_purchase_order(*, purchase_order, user, notes=''):
    if purchase_order.estado not in [PurchaseOrder.Status.DRAFT, PurchaseOrder.Status.SENT, PurchaseOrder.Status.PARTIALLY_RECEIVED]:
        raise ValidationError({'detail': 'La orden no puede cancelarse en su estado actual.'})

    previous = purchase_order.estado
    purchase_order.estado = PurchaseOrder.Status.CANCELLED
    purchase_order.save(update_fields=['estado', 'updated_at'])
    PurchaseOrderStatusHistory.objects.create(
        purchase_order=purchase_order,
        estado_anterior=previous,
        estado_nuevo=purchase_order.estado,
        cambiado_por=user,
        motivo=notes or 'Orden cancelada',
    )
    log_audit(module='suppliers', action='STATUS_CHANGE', user=user, obj=purchase_order, before_data={'estado': previous}, after_data={'estado': purchase_order.estado})
    return purchase_order


@transaction.atomic
def receive_purchase_order(*, purchase_order, user, items, notes='', close_incomplete=False):
    if purchase_order.estado not in [PurchaseOrder.Status.SENT, PurchaseOrder.Status.PARTIALLY_RECEIVED]:
        raise ValidationError({'detail': 'Solo se pueden recibir ordenes enviadas o parciales.'})

    warehouse = purchase_order.destination_warehouse
    received_any = False
    for raw_item in items:
        po_item = PurchaseOrderItem.objects.select_for_update().select_related('product').get(
            purchase_order=purchase_order,
            pk=raw_item['id'],
        )
        qty = _decimalize(raw_item['cantidad_recibida'], 'cantidad_recibida')
        if qty <= 0:
            continue
        pending = po_item.cantidad_pedida - po_item.cantidad_recibida
        if qty > pending:
            raise ValidationError({'cantidad_recibida': f'La cantidad recibida supera lo pendiente para {po_item.product.nombre}.'})
        serial_numbers = raw_item.get('serial_numbers')
        if po_item.product.is_serializable and qty > 0:
            serial_numbers = _normalize_serial_numbers(
                serial_numbers=serial_numbers,
                expected_quantity=qty,
                product_name=po_item.product.nombre,
            )

        stock_item = get_or_create_stock_item(
            po_item.product,
            warehouse,
            defaults={
                'cantidad': Decimal('0.000'),
                'reservado': Decimal('0.000'),
                'costo_promedio': Decimal('0.0000'),
            },
            lock=True,
        )
        previous_qty = stock_item.cantidad
        previous_cost = stock_item.costo_promedio or Decimal('0.0000')
        stock_item.cantidad = (stock_item.cantidad + qty).quantize(QTY_QUANTIZE, rounding=ROUND_HALF_UP)
        if stock_item.cantidad > 0:
            incoming_cost = Decimal(str(po_item.precio_unitario)).quantize(COST_QUANTIZE, rounding=ROUND_HALF_UP)
            total_previous = previous_qty * previous_cost
            total_new = qty * incoming_cost
            stock_item.costo_promedio = ((total_previous + total_new) / stock_item.cantidad).quantize(COST_QUANTIZE, rounding=ROUND_HALF_UP)
        stock_item.save(update_fields=['cantidad', 'costo_promedio', 'updated_at'])

        po_item.cantidad_recibida = (po_item.cantidad_recibida + qty).quantize(QTY_QUANTIZE, rounding=ROUND_HALF_UP)
        if serial_numbers is not None:
            existing_serials = po_item.serial_numbers or []
            repeated_serials = set(existing_serials).intersection(serial_numbers)
            if repeated_serials:
                raise ValidationError({
                    'serial_numbers': (
                        f'Los números de serie {", ".join(sorted(repeated_serials))} ya fueron registrados para {po_item.product.nombre}.'
                    )
                })
            po_item.serial_numbers = [*existing_serials, *serial_numbers]
        po_item.save(update_fields=['cantidad_recibida', 'serial_numbers'])

        record_inventory_movement(
            product=po_item.product,
            warehouse=warehouse,
            movement_type=InventoryMovement.MovementType.ENTRY,
            quantity=qty,
            user=user,
            unit_cost=po_item.precio_unitario,
            reference_type='PurchaseOrder',
            reference_id=purchase_order.id,
            notes=notes or f'Recepcion OC {purchase_order.folio}',
            serial_numbers=serial_numbers,
        )
        received_any = True

    if not received_any:
        raise ValidationError({'items': 'Debes recibir al menos un item con cantidad mayor a 0.'})

    all_received = not purchase_order.items.filter(cantidad_recibida__lt=F('cantidad_pedida')).exists()
    previous = purchase_order.estado
    if all_received:
        purchase_order.estado = PurchaseOrder.Status.RECEIVED
    elif close_incomplete:
        purchase_order.estado = PurchaseOrder.Status.CLOSED_INCOMPLETE
    else:
        purchase_order.estado = PurchaseOrder.Status.PARTIALLY_RECEIVED

    if all_received or close_incomplete:
        purchase_order.received_at = timezone.now()
    purchase_order.save(update_fields=['estado', 'received_at', 'updated_at'])
    PurchaseOrderStatusHistory.objects.create(
        purchase_order=purchase_order,
        estado_anterior=previous,
        estado_nuevo=purchase_order.estado,
        cambiado_por=user,
        motivo=notes or 'Recepcion registrada',
    )
    log_audit(module='suppliers', action='STATUS_CHANGE', user=user, obj=purchase_order, before_data={'estado': previous}, after_data={'estado': purchase_order.estado})
    return purchase_order


def get_purchase_suggestions():
    products = Product.objects.annotate(
        stock_fisico=Coalesce(Sum('stocks__cantidad'), Decimal('0.000')),
        stock_reservado=Coalesce(Sum('stocks__reservado'), Decimal('0.000')),
    ).filter(activo=True, deleted_at__isnull=True)
    suggestions = []
    for product in products:
        disponible = (product.stock_fisico or 0) - (product.stock_reservado or 0)
        if disponible <= product.stock_minimo:
            suggestions.append({
                'product_id': product.id,
                'product_name': product.nombre,
                'product_code': product.codigo,
                'available': str(disponible),
                'minimum': str(product.stock_minimo),
                'suggested_quantity': str(max(product.stock_minimo - int(disponible) + 1, 1)),
            })
    return suggestions
