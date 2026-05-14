from rest_framework import serializers
from apps.customers.serializers import CustomerListSerializer, DeviceSerializer
from apps.users.serializers import UserSerializer
from .models import Ticket, TicketAccessory, TicketEvidence, TicketTransition

class TicketAccessorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketAccessory
        fields = ['id', 'nombre', 'condicion', 'notas']

class TicketEvidenceSerializer(serializers.ModelSerializer):
    subido_por = UserSerializer(read_only=True)
    class Meta:
        model = TicketEvidence
        fields = ['id', 'archivo', 'nombre_archivo', 'tamano_archivo', 'tipo_archivo', 'subido_por', 'created_at']
        read_only_fields = ['subido_por', 'nombre_archivo', 'tamano_archivo', 'tipo_archivo']

class TicketTransitionSerializer(serializers.ModelSerializer):
    cambiado_por = UserSerializer(read_only=True)
    
    class Meta:
        model = TicketTransition
        fields = ['id', 'estado_anterior', 'estado_nuevo', 'cambiado_por', 'motivo', 'fue_automatico', 'created_at']

class TicketListSerializer(serializers.ModelSerializer):
    customer = CustomerListSerializer(read_only=True)
    device = DeviceSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    
    class Meta:
        model = Ticket
        fields = ['id', 'folio', 'customer', 'device', 'assigned_to', 'estado', 'prioridad', 'monto_estimado', 'monto_aprobado', 'total', 'created_at']

class TicketDetailSerializer(serializers.ModelSerializer):
    customer = CustomerListSerializer(read_only=True)
    device = DeviceSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    accessories = TicketAccessorySerializer(many=True, read_only=True)
    evidences = TicketEvidenceSerializer(many=True, read_only=True)
    transitions = TicketTransitionSerializer(many=True, read_only=True)
    receipts = serializers.SerializerMethodField()
    active_quote = serializers.SerializerMethodField()
    stock_reservations = serializers.SerializerMethodField()
    
    class Meta:
        model = Ticket
        fields = '__all__'

    def get_receipts(self, obj):
        from apps.finance.serializers import ReceiptSerializer
        return ReceiptSerializer(obj.receipts.all().order_by('-created_at'), many=True).data

    def get_active_quote(self, obj):
        try:
            from apps.quotes.serializers import QuoteSummarySerializer
            from apps.quotes.services import get_active_ticket_quote

            quote = get_active_ticket_quote(obj)
            if not quote:
                return None
            return QuoteSummarySerializer(quote).data
        except Exception:
            return None

    def get_stock_reservations(self, obj):
        try:
            from apps.products.serializers import StockReservationSerializer
            return StockReservationSerializer(obj.stock_reservations.all().order_by('-created_at'), many=True).data
        except Exception:
            return []
