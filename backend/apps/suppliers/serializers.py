from rest_framework import serializers

from .models import PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatusHistory, Supplier


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'deleted_at')


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.nombre')
    product_code = serializers.ReadOnlyField(source='product.codigo')

    class Meta:
        model = PurchaseOrderItem
        fields = [
            'id', 'product', 'product_name', 'product_code',
            'cantidad_pedida', 'cantidad_recibida', 'precio_unitario',
            'serial_numbers', 'created_at',
        ]


class PurchaseOrderStatusHistorySerializer(serializers.ModelSerializer):
    cambiado_por_nombre = serializers.ReadOnlyField(source='cambiado_por.nombre')

    class Meta:
        model = PurchaseOrderStatusHistory
        fields = ['id', 'estado_anterior', 'estado_nuevo', 'cambiado_por', 'cambiado_por_nombre', 'motivo', 'created_at']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.ReadOnlyField(source='supplier.nombre')
    destination_warehouse_name = serializers.ReadOnlyField(source='destination_warehouse.nombre')
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    status_history = PurchaseOrderStatusHistorySerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'folio', 'supplier', 'supplier_name', 'destination_warehouse',
            'destination_warehouse_name', 'estado', 'subtotal', 'notes',
            'created_by', 'sent_at', 'received_at', 'created_at', 'updated_at',
            'items', 'status_history',
        ]
        read_only_fields = ('folio', 'subtotal', 'created_by', 'sent_at', 'received_at', 'created_at', 'updated_at')
