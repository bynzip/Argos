from apps.customers.models import Customer


GENERIC_CUSTOMER_IDENTIFIER = '00000000'
GENERIC_CUSTOMER_NAME = 'CLIENTE GENERICO'


def get_or_create_generic_customer():
    customer, _ = Customer.all_objects.get_or_create(
        tipo_cliente='PERSONA',
        identificador=GENERIC_CUSTOMER_IDENTIFIER,
        defaults={
            'nombre': GENERIC_CUSTOMER_NAME,
            'telefono': '',
            'direccion': '',
            'etiqueta': 'REGULAR',
            'is_active': True,
            'deleted_at': None,
        },
    )

    if customer.deleted_at is not None or not customer.is_active:
        customer.restore()
    if customer.nombre != GENERIC_CUSTOMER_NAME:
        customer.nombre = GENERIC_CUSTOMER_NAME
        customer.save(update_fields=['nombre', 'updated_at'])
    return customer
