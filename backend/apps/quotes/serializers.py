from rest_framework import serializers

from apps.customers.serializers import CustomerListSerializer, DeviceSerializer
from apps.users.serializers import UserSerializer

from .models import Quote, QuoteApproval, QuoteAttachment, QuoteLine


class QuoteLineSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.nombre')
    service_name = serializers.ReadOnlyField(source='service.nombre')

    class Meta:
        model = QuoteLine
        fields = (
            'id', 'line_type', 'product', 'product_name', 'service', 'service_name',
            'descripcion', 'cantidad', 'precio_unitario', 'descuento_linea',
            'total_linea', 'supply_status', 'orden'
        )


class QuoteApprovalSerializer(serializers.ModelSerializer):
    decidido_por = UserSerializer(read_only=True)

    class Meta:
        model = QuoteApproval
        fields = ('id', 'approval_type', 'required_level', 'estado', 'decidido_por', 'decidido_el', 'notas', 'created_at')


class QuoteAttachmentSerializer(serializers.ModelSerializer):
    subido_por = UserSerializer(read_only=True)

    class Meta:
        model = QuoteAttachment
        fields = ('id', 'archivo', 'nombre_archivo', 'tamano_archivo', 'subido_por', 'created_at')


class QuoteTicketSummarySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    folio = serializers.CharField()
    estado = serializers.CharField()


class QuoteListSerializer(serializers.ModelSerializer):
    customer = CustomerListSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    source_ticket = QuoteTicketSummarySerializer(read_only=True)
    requires_amount_approval = serializers.SerializerMethodField()
    latest_amount_approval_status = serializers.SerializerMethodField()

    class Meta:
        model = Quote
        fields = (
            'id', 'folio', 'version', 'customer', 'source_ticket', 'created_by', 'estado',
            'subtotal', 'descuento', 'igv_rate', 'igv_amount', 'total', 'valido_hasta',
            'is_active_version', 'requires_amount_approval', 'latest_amount_approval_status',
            'created_at', 'updated_at'
        )

    def get_requires_amount_approval(self, obj):
        from .services import quote_requires_amount_approval
        return quote_requires_amount_approval(obj)

    def get_latest_amount_approval_status(self, obj):
        approval = obj.approvals.filter(approval_type=QuoteApproval.ApprovalType.AMOUNT).order_by('-created_at').first()
        return approval.estado if approval else None


class QuoteDetailSerializer(serializers.ModelSerializer):
    customer = CustomerListSerializer(read_only=True)
    device = DeviceSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    source_ticket = QuoteTicketSummarySerializer(read_only=True)
    lines = QuoteLineSerializer(many=True, read_only=True)
    approvals = QuoteApprovalSerializer(many=True, read_only=True)
    attachments = QuoteAttachmentSerializer(many=True, read_only=True)
    version_history = serializers.SerializerMethodField()
    requires_amount_approval = serializers.SerializerMethodField()
    latest_amount_approval_status = serializers.SerializerMethodField()

    class Meta:
        model = Quote
        fields = (
            'id', 'folio', 'version', 'base_quote', 'customer', 'device', 'source_ticket',
            'created_by', 'estado', 'subtotal', 'igv_rate', 'igv_amount', 'descuento',
            'total', 'valido_hasta', 'condiciones', 'notas', 'is_active_version',
            'requires_amount_approval', 'latest_amount_approval_status',
            'lines', 'approvals', 'attachments', 'version_history', 'created_at', 'updated_at'
        )

    def get_version_history(self, obj):
        root_quote = obj.base_quote or obj
        history = Quote.objects.filter(folio=root_quote.folio).order_by('version')
        return [
            {
                'id': quote.id,
                'version': quote.version,
                'estado': quote.estado,
                'is_active_version': quote.is_active_version,
                'created_at': quote.created_at,
            }
            for quote in history
        ]

    def get_requires_amount_approval(self, obj):
        from .services import quote_requires_amount_approval
        return quote_requires_amount_approval(obj)

    def get_latest_amount_approval_status(self, obj):
        approval = obj.approvals.filter(approval_type=QuoteApproval.ApprovalType.AMOUNT).order_by('-created_at').first()
        return approval.estado if approval else None


class QuoteSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Quote
        fields = ('id', 'folio', 'version', 'estado', 'total', 'is_active_version')

