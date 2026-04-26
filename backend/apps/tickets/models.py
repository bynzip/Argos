import uuid
from django.db import models
from apps.customers.models import SoftDeleteModel, Customer, Device
from apps.users.models import User, Subarea

class Ticket(SoftDeleteModel):
    class TicketStatus(models.TextChoices):
        INTAKE = 'INTAKE', 'Ingreso'
        DIAGNOSTIC = 'DIAGNOSTIC', 'Diagnóstico'
        QUOTED = 'QUOTED', 'Cotizado'
        APPROVED = 'APPROVED', 'Aprobado'
        WAITING_PARTS = 'WAITING_PARTS', 'En espera de repuesto'
        IN_REPAIR = 'IN_REPAIR', 'En reparación'
        IN_TESTING = 'IN_TESTING', 'En pruebas'
        READY = 'READY', 'Listo'
        DELIVERED = 'DELIVERED', 'Entregado'
        CLOSED = 'CLOSED', 'Cerrado'
        REJECTED = 'REJECTED', 'Rechazado'
        STORAGE = 'STORAGE', 'Cochera'

    class TicketPriority(models.TextChoices):
        LOW = 'LOW', 'Baja'
        MEDIUM = 'MEDIUM', 'Media'
        HIGH = 'HIGH', 'Alta'
        CRITICAL = 'CRITICAL', 'Crítica'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    folio = models.CharField(max_length=20, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.RESTRICT, related_name='tickets')
    device = models.ForeignKey(Device, on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tickets')
    subarea = models.ForeignKey(Subarea, on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    
    estado = models.CharField(max_length=30, choices=TicketStatus.choices, default=TicketStatus.INTAKE)
    prioridad = models.CharField(max_length=10, choices=TicketPriority.choices, default=TicketPriority.LOW)
    
    descripcion_problema = models.TextField()
    diagnostico = models.TextField(null=True, blank=True)
    solucion = models.TextField(null=True, blank=True)
    
    monto_estimado = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    monto_aprobado = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    ticket_padre = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets_garantia')
    es_garantia = models.BooleanField(default=False)
    
    clave_consulta = models.CharField(max_length=8, null=True, blank=True)
    entrega_estimada = models.DateTimeField(null=True, blank=True)
    fecha_entrega_real = models.DateTimeField(null=True, blank=True)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_tickets')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tickets'
        indexes = [
            models.Index(fields=['customer']),
            models.Index(fields=['assigned_to']),
            models.Index(fields=['estado']),
            models.Index(fields=['created_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['clave_consulta'],
                condition=models.Q(clave_consulta__isnull=False),
                name='unique_clave_consulta_if_not_null'
            )
        ]

    def __str__(self):
        return self.folio

    @property
    def saldo_pendiente(self):
        from apps.finance.models import Receipt
        pagos_confirmados = self.receipts.filter(estado=Receipt.ReceiptStatus.CONFIRMED).aggregate(
            total=models.Sum('amount')
        )['total'] or 0
        return self.total - pagos_confirmados

class TicketAccessory(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='accessories')
    nombre = models.CharField(max_length=150)
    condicion = models.CharField(max_length=50, null=True, blank=True)
    notas = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ticket_accessories'

    def __str__(self):
        return f"{self.nombre} - {self.ticket.folio}"

class TicketEvidence(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='evidences')
    archivo = models.FileField(upload_to='tickets/evidencias/%Y/%m/%d/', max_length=500)
    nombre_archivo = models.CharField(max_length=255)
    tamano_archivo = models.IntegerField(null=True, blank=True)
    tipo_archivo = models.CharField(max_length=100, null=True, blank=True)
    subido_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_evidences')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ticket_evidences'

    def __str__(self):
        return self.nombre_archivo

class TicketTransition(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='transitions')
    estado_anterior = models.CharField(max_length=30, choices=Ticket.TicketStatus.choices, null=True, blank=True)
    estado_nuevo = models.CharField(max_length=30, choices=Ticket.TicketStatus.choices)
    cambiado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='ticket_transitions')
    motivo = models.TextField(null=True, blank=True)
    fue_automatico = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ticket_transitions'
        indexes = [
            models.Index(fields=['ticket']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.ticket.folio}: {self.estado_anterior} -> {self.estado_nuevo}"
