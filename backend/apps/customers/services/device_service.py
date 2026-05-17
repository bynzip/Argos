from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from apps.customers.models import Device

def register_device(customer, data):
    with transaction.atomic():
        try:
            return Device.objects.create(
                customer=customer,
                tipo_equipo=(data.get('tipo_equipo') or '').strip(),
                marca=(data.get('marca') or '').strip(),
                modelo=(data.get('modelo') or '').strip(),
                numero_serie=(data.get('numero_serie') or '').strip(),
                notas=(data.get('notas') or '').strip(),
            )
        except IntegrityError as exc:
            raise ValidationError(
                'Este dispositivo ya está registrado para este cliente. Si deseas verlo, encuéntralo en la lista de dispositivos.'
            ) from exc
