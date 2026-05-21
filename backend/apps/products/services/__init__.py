from .inventory_service import (
    adjust_stock,
    consume_direct_quote_stock,
    consume_reservation,
    consume_reserved_quote_materials_for_ticket,
    record_inventory_movement,
    release_reservation,
    release_ticket_reservations,
    reserve_quote_materials_for_ticket,
    reserve_stock,
    ticket_has_active_reservations,
    transfer_stock,
)
from .product_service import create_product
