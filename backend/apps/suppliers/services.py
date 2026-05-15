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


def _recalculate_po_subtotal(purchase_order):
    subtotal = purchase_order.items.aggregate(
        total=Sum(F('cantidad_pedida') * F('precio_unitario'))
    )['total'] or Decimal('0.00')
    purchase_order.subtotal = Decimal(subtotal).quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
    purchase_order.save(update_fields=['subtotal', 'updated_at'])
    return purchase_order


@transaction.atomic
def create_supplier_order(*, user, supplier, destination_warehouse, items, notes=''):
    if not items:
        raise ValidationError({'items': 'Debes agregar al menos un item.'})

    purchase_order = PurchaseOrder.objects.create(
        folio=generate_folio('PO'),
        supplier=supplier,
        destination_warehouse=destination_warehouse,
        notes=notes or '',
        created_by=user,
    )

    for item in items:
        product = Product.objects.get(pk=item['product'])
        PurchaseOrderItem.objects.create(
            purchase_order=purchase_order,
            product=product,
            cantidad_pedida=_decimalize(item['cantidad_pedida'], 'cantidad_pedida'),
            precio_unitario=_decimalize(item['precio_unitario'], 'precio_unitario', MONEY_QUANTIZE),
        )

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
def receive_purchase_order(*, purchase_order, user, items, notes=''):
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
        if raw_item.get('serial_numbers') is not None:
            po_item.serial_numbers = raw_item.get('serial_numbers')
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
            serial_numbers=raw_item.get('serial_numbers'),
        )
        received_any = True

    if not received_any:
        raise ValidationError({'items': 'Debes recibir al menos un item con cantidad mayor a 0.'})

    all_received = not purchase_order.items.filter(cantidad_recibida__lt=F('cantidad_pedida')).exists()
    previous = purchase_order.estado
    purchase_order.estado = PurchaseOrder.Status.RECEIVED if all_received else PurchaseOrder.Status.PARTIALLY_RECEIVED
    if all_received:
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
