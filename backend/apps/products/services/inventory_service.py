from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.products.models import InventoryMovement, Product, StockItem, StockReservation, Warehouse
from apps.tickets.models import Ticket

QTY_QUANTIZE = Decimal('0.001')
MONEY_QUANTIZE = Decimal('0.01')
COST_QUANTIZE = Decimal('0.0001')
RESERVABLE_TICKET_STATUSES = {
    Ticket.TicketStatus.APPROVED,
    Ticket.TicketStatus.WAITING_PARTS,
    Ticket.TicketStatus.IN_REPAIR,
}


def decimalize_quantity(value, field_name='cantidad'):
    try:
        quantity = Decimal(str(value)).quantize(QTY_QUANTIZE, rounding=ROUND_HALF_UP)
    except Exception as exc:
        raise ValidationError({field_name: f'El campo {field_name} tiene un valor inválido.'}) from exc

    if quantity <= 0:
        raise ValidationError({field_name: 'La cantidad debe ser mayor a 0.'})
    return quantity


def decimalize_money(value, field_name):
    if value in (None, ''):
        return None

    try:
        return Decimal(str(value)).quantize(COST_QUANTIZE, rounding=ROUND_HALF_UP)
    except Exception as exc:
        raise ValidationError({field_name: f'El campo {field_name} tiene un valor inválido.'}) from exc


def get_or_create_stock_item(product, warehouse, defaults=None, lock=False):
    manager = StockItem.objects
    if lock:
        manager = manager.select_for_update()
    stock_item, _ = manager.get_or_create(
        product=product,
        warehouse=warehouse,
        defaults=defaults or {},
    )
    return stock_item


def record_inventory_movement(
    *,
    product,
    warehouse,
    movement_type,
    quantity,
    user=None,
    destination_warehouse=None,
    unit_cost=None,
    reference_type='',
    reference_id='',
    notes='',
    serial_numbers=None,
):
    quantity = decimalize_quantity(quantity)
    unit_cost_decimal = decimalize_money(unit_cost, 'unit_cost')
    total_cost = None
    if unit_cost_decimal is not None:
        total_cost = (unit_cost_decimal * quantity).quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)

    return InventoryMovement.objects.create(
        product=product,
        warehouse=warehouse,
        destination_warehouse=destination_warehouse,
        movement_type=movement_type,
        quantity=quantity,
        unit_cost=unit_cost_decimal,
        total_cost=total_cost,
        reference_type=reference_type or '',
        reference_id=str(reference_id or ''),
        serial_numbers=serial_numbers,
        notes=notes or '',
        created_by=user,
    )


def create_initial_stock(product, quantity, warehouse=None, user=None):
    quantity = decimalize_quantity(quantity)
    warehouse = warehouse or Warehouse.objects.get_or_create(
        nombre='Almacén Principal',
        defaults={'ubicacion': 'Sede Central'}
    )[0]

    with transaction.atomic():
        stock_item = get_or_create_stock_item(
            product,
            warehouse,
            defaults={'cantidad': Decimal('0.000'), 'reservado': Decimal('0.000'), 'costo_promedio': Decimal('0.0000')},
            lock=True,
        )
        stock_item.cantidad = (stock_item.cantidad + quantity).quantize(QTY_QUANTIZE, rounding=ROUND_HALF_UP)
        stock_item.save(update_fields=['cantidad', 'updated_at'])

        record_inventory_movement(
            product=product,
            warehouse=warehouse,
            movement_type=InventoryMovement.MovementType.ADJUSTMENT_IN,
            quantity=quantity,
            user=user,
            unit_cost=product.precio_costo,
            reference_type='Product',
            reference_id=product.id,
            notes='Stock inicial al crear producto',
        )
        return stock_item


def ensure_ticket_can_reserve(ticket):
    if ticket.estado not in RESERVABLE_TICKET_STATUSES:
        raise ValidationError({
            'ticket': 'Solo se puede reservar stock para tickets aprobados, en espera de repuestos o en reparación.'
        })


@transaction.atomic
def reserve_stock(*, stock_item, ticket, quantity, user, notes=''):
    ensure_ticket_can_reserve(ticket)
    quantity = decimalize_quantity(quantity)

    locked_stock_item = StockItem.objects.select_for_update().select_related('product', 'warehouse').get(pk=stock_item.pk)
    available = locked_stock_item.disponible
    if quantity > available:
        raise ValidationError({
            'cantidad': f'No hay stock disponible suficiente. Disponible actual: {available}.'
        })

    reservation = StockReservation.objects.create(
        stock_item=locked_stock_item,
        ticket=ticket,
        cantidad=quantity,
        reservado_por=user,
        notas=notes or '',
    )
    locked_stock_item.reservado = (locked_stock_item.reservado + quantity).quantize(QTY_QUANTIZE, rounding=ROUND_HALF_UP)
    locked_stock_item.save(update_fields=['reservado', 'updated_at'])
    return reservation


@transaction.atomic
def release_reservation(*, reservation, user=None, notes=''):
    locked_reservation = StockReservation.objects.select_for_update().select_related('stock_item', 'ticket').get(pk=reservation.pk)
    if locked_reservation.estado != StockReservation.ReservationStatus.ACTIVE:
        raise ValidationError({'detail': 'Solo se pueden liberar reservas activas.'})

    stock_item = StockItem.objects.select_for_update().get(pk=locked_reservation.stock_item_id)
    stock_item.reservado = max(
        Decimal('0.000'),
        (stock_item.reservado - locked_reservation.cantidad).quantize(QTY_QUANTIZE, rounding=ROUND_HALF_UP)
    )
    stock_item.save(update_fields=['reservado', 'updated_at'])

    locked_reservation.estado = StockReservation.ReservationStatus.RELEASED
    locked_reservation.liberado_el = timezone.now()
    if notes:
        locked_reservation.notas = f"{locked_reservation.notas}\n{notes}".strip()
    locked_reservation.save(update_fields=['estado', 'liberado_el', 'notas'])
    return locked_reservation


@transaction.atomic
def consume_reservation(*, reservation, user=None, notes=''):
    locked_reservation = StockReservation.objects.select_for_update().select_related(
        'stock_item__product', 'stock_item__warehouse', 'ticket'
    ).get(pk=reservation.pk)
    if locked_reservation.estado != StockReservation.ReservationStatus.ACTIVE:
        raise ValidationError({'detail': 'Solo se pueden consumir reservas activas.'})

    stock_item = StockItem.objects.select_for_update().get(pk=locked_reservation.stock_item_id)
    if locked_reservation.cantidad > stock_item.cantidad:
        raise ValidationError({'detail': 'El stock físico es insuficiente para consumir esta reserva.'})

    stock_item.cantidad = (stock_item.cantidad - locked_reservation.cantidad).quantize(QTY_QUANTIZE, rounding=ROUND_HALF_UP)
    stock_item.reservado = max(
        Decimal('0.000'),
        (stock_item.reservado - locked_reservation.cantidad).quantize(QTY_QUANTIZE, rounding=ROUND_HALF_UP)
    )
    stock_item.save(update_fields=['cantidad', 'reservado', 'updated_at'])

    locked_reservation.estado = StockReservation.ReservationStatus.CONSUMED
    locked_reservation.consumido_el = timezone.now()
    if notes:
        locked_reservation.notas = f"{locked_reservation.notas}\n{notes}".strip()
    locked_reservation.save(update_fields=['estado', 'consumido_el', 'notas'])

    record_inventory_movement(
        product=stock_item.product,
        warehouse=stock_item.warehouse,
        movement_type=InventoryMovement.MovementType.EXIT,
        quantity=locked_reservation.cantidad,
        user=user,
        unit_cost=stock_item.costo_promedio or stock_item.product.precio_costo,
        reference_type='Ticket',
        reference_id=locked_reservation.ticket_id,
        notes=notes or f'Consumo de reserva para ticket {locked_reservation.ticket.folio}',
    )
    return locked_reservation


@transaction.atomic
def adjust_stock(*, stock_item, movement_type, quantity, user, notes, unit_cost=None):
    quantity = decimalize_quantity(quantity)
    if movement_type not in {
        InventoryMovement.MovementType.ADJUSTMENT_IN,
        InventoryMovement.MovementType.ADJUSTMENT_OUT,
    }:
        raise ValidationError({'movement_type': 'Tipo de ajuste inválido.'})
    if not notes:
        raise ValidationError({'notes': 'Los ajustes manuales requieren una nota obligatoria.'})

    locked_stock_item = StockItem.objects.select_for_update().select_related('product', 'warehouse').get(pk=stock_item.pk)
    if movement_type == InventoryMovement.MovementType.ADJUSTMENT_IN:
        locked_stock_item.cantidad = (locked_stock_item.cantidad + quantity).quantize(QTY_QUANTIZE, rounding=ROUND_HALF_UP)
    else:
        if quantity > locked_stock_item.disponible:
            raise ValidationError({'cantidad': 'No puedes ajustar salida por encima del stock disponible.'})
        locked_stock_item.cantidad = (locked_stock_item.cantidad - quantity).quantize(QTY_QUANTIZE, rounding=ROUND_HALF_UP)

    if unit_cost is not None:
        locked_stock_item.costo_promedio = decimalize_money(unit_cost, 'unit_cost') or locked_stock_item.costo_promedio
        update_fields = ['cantidad', 'costo_promedio', 'updated_at']
    else:
        update_fields = ['cantidad', 'updated_at']
    locked_stock_item.save(update_fields=update_fields)

    record_inventory_movement(
        product=locked_stock_item.product,
        warehouse=locked_stock_item.warehouse,
        movement_type=movement_type,
        quantity=quantity,
        user=user,
        unit_cost=unit_cost if unit_cost is not None else locked_stock_item.costo_promedio,
        reference_type='ManualAdjustment',
        reference_id=locked_stock_item.id,
        notes=notes,
    )
    return locked_stock_item


@transaction.atomic
def transfer_stock(*, source_stock_item, destination_warehouse, quantity, user, notes=''):
    quantity = decimalize_quantity(quantity)
    locked_source = StockItem.objects.select_for_update().select_related('product', 'warehouse').get(pk=source_stock_item.pk)
    if destination_warehouse.id == locked_source.warehouse_id:
        raise ValidationError({'destination_warehouse': 'El almacén destino debe ser diferente al origen.'})
    if quantity > locked_source.disponible:
        raise ValidationError({'cantidad': 'No puedes transferir más del stock disponible.'})

    locked_destination = get_or_create_stock_item(
        locked_source.product,
        destination_warehouse,
        defaults={'cantidad': Decimal('0.000'), 'reservado': Decimal('0.000'), 'costo_promedio': locked_source.costo_promedio},
        lock=True,
    )

    locked_source.cantidad = (locked_source.cantidad - quantity).quantize(QTY_QUANTIZE, rounding=ROUND_HALF_UP)
    locked_destination.cantidad = (locked_destination.cantidad + quantity).quantize(QTY_QUANTIZE, rounding=ROUND_HALF_UP)
    if locked_source.costo_promedio and not locked_destination.costo_promedio:
        locked_destination.costo_promedio = locked_source.costo_promedio

    locked_source.save(update_fields=['cantidad', 'updated_at'])
    locked_destination.save(update_fields=['cantidad', 'costo_promedio', 'updated_at'])

    record_inventory_movement(
        product=locked_source.product,
        warehouse=locked_source.warehouse,
        destination_warehouse=destination_warehouse,
        movement_type=InventoryMovement.MovementType.TRANSFER_OUT,
        quantity=quantity,
        user=user,
        unit_cost=locked_source.costo_promedio or locked_source.product.precio_costo,
        reference_type='Transfer',
        reference_id=f'{locked_source.id}:{locked_destination.id}',
        notes=notes or f'Transferencia a {destination_warehouse.nombre}',
    )
    record_inventory_movement(
        product=locked_source.product,
        warehouse=destination_warehouse,
        destination_warehouse=locked_source.warehouse,
        movement_type=InventoryMovement.MovementType.TRANSFER_IN,
        quantity=quantity,
        user=user,
        unit_cost=locked_source.costo_promedio or locked_source.product.precio_costo,
        reference_type='Transfer',
        reference_id=f'{locked_source.id}:{locked_destination.id}',
        notes=notes or f'Transferencia desde {locked_source.warehouse.nombre}',
    )

    return locked_source, locked_destination


def release_ticket_reservations(*, ticket, user=None, reason=''):
    active_reservations = ticket.stock_reservations.filter(estado=StockReservation.ReservationStatus.ACTIVE)
    released = []
    for reservation in active_reservations:
        released.append(release_reservation(reservation=reservation, user=user, notes=reason))
    return released


def ticket_has_active_reservations(ticket):
    return ticket.stock_reservations.filter(estado=StockReservation.ReservationStatus.ACTIVE).exists()


def get_ticket_reserved_products(ticket):
    return ticket.stock_reservations.filter(
        estado=StockReservation.ReservationStatus.ACTIVE
    ).values('stock_item__product_id').annotate(total=Sum('cantidad'))

