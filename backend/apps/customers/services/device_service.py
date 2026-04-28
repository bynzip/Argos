from django.db import transaction
from apps.customers.models import Device

def register_device(customer, data):
    with transaction.atomic():
        return Device.objects.create(
            customer=customer,
            tipo_equipo=data.get('tipo_equipo'),
            marca=data.get('marca'),
            modelo=data.get('modelo'),
            numero_serie=data.get('numero_serie', ''),
            notas=data.get('notas', '')
        )