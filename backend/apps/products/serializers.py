from django.db.models import DecimalField, ExpressionWrapper, F
from rest_framework import serializers

from apps.tickets.models import Ticket

from .models import (
    Brand,
    Category,
    InventoryMovement,
    Product,
    ProductSupplier,
    StockItem,
    StockReservation,
    Warehouse,
)
from .services import create_product


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = '__all__'


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = '__all__'


class ProductSupplierSerializer(serializers.ModelSerializer):
    supplier_name = serializers.ReadOnlyField(source='supplier.nombre')
    product_name = serializers.ReadOnlyField(source='product.nombre')

    class Meta:
        model = ProductSupplier
        fields = (
            'product', 'product_name',
            'id', 'supplier', 'supplier_name', 'supplier_id_legacy',
            'supplier_price', 'lead_time_days', 'is_primary', 'created_at'
        )

    def validate(self, attrs):
        supplier = attrs.get('supplier') or getattr(self.instance, 'supplier', None)
        product = attrs.get('product') or getattr(self.instance, 'product', None)
        if not supplier:
            raise serializers.ValidationError({'supplier': 'El proveedor es obligatorio.'})
        if not product:
            raise serializers.ValidationError({'product': 'El producto es obligatorio.'})
        return attrs

    def _ensure_single_primary(self, instance):
        if instance.is_primary:
            ProductSupplier.objects.filter(product=instance.product).exclude(pk=instance.pk).update(is_primary=False)

    def create(self, validated_data):
        instance = super().create(validated_data)
        self._ensure_single_primary(instance)
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self._ensure_single_primary(instance)
        return instance


class ProductStockSummarySerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.nombre')
    brand_name = serializers.ReadOnlyField(source='brand.nombre')

    class Meta:
        model = Product
        fields = ('id', 'codigo', 'nombre', 'category_name', 'brand_name', 'stock_minimo')


class StockItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.nombre')
    product_code = serializers.ReadOnlyField(source='product.codigo')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.nombre')
    disponible = serializers.SerializerMethodField()

    class Meta:
        model = StockItem
        fields = (
            'id',
            'product',
            'product_name',
            'product_code',
            'warehouse',
            'warehouse_name',
            'cantidad',
            'reservado',
            'disponible',
            'costo_promedio',
            'ubicacion_especifica',
            'created_at',
            'updated_at',
        )

    def get_disponible(self, obj):
        if hasattr(obj, 'available_db'):
            return obj.available_db
        return obj.disponible


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.nombre')
    brand_name = serializers.ReadOnlyField(source='brand.nombre')
    stocks = StockItemSerializer(many=True, read_only=True)
    total_stock = serializers.SerializerMethodField()
    total_stock_fisico = serializers.SerializerMethodField()
    total_stock_reservado = serializers.SerializerMethodField()
    total_stock_disponible = serializers.SerializerMethodField()
    initial_stock = serializers.DecimalField(
        write_only=True,
        required=False,
        default='0.000',
        max_digits=12,
        decimal_places=3,
    )
    product_suppliers = ProductSupplierSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = (
            'id',
            'codigo',
            'nombre',
            'descripcion',
            'category',
            'category_name',
            'brand',
            'brand_name',
            'precio_costo',
            'precio_venta',
            'stock_minimo',
            'unidad',
            'is_serializable',
            'activo',
            'total_stock',
            'total_stock_fisico',
            'total_stock_reservado',
            'total_stock_disponible',
            'stocks',
            'product_suppliers',
            'created_at',
            'initial_stock',
        )
        read_only_fields = ('id', 'created_at')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')

        if request and request.user.is_authenticated and not request.user.is_superuser:
            role = request.user.user_roles.first().role.nombre if request.user.user_roles.exists() else ''
            if role not in ['Administrador', 'Almacenero']:
                data.pop('precio_costo', None)
                data.pop('product_suppliers', None)

        return data

    def get_total_stock_fisico(self, obj):
        if hasattr(obj, 'total_stock_fisico_db'):
            return obj.total_stock_fisico_db
        return sum(item.cantidad for item in obj.stocks.all())

    def get_total_stock_reservado(self, obj):
        if hasattr(obj, 'total_stock_reservado_db'):
            return obj.total_stock_reservado_db
        return sum(item.reservado for item in obj.stocks.all())

    def get_total_stock_disponible(self, obj):
        if hasattr(obj, 'total_stock_disponible_db'):
            return obj.total_stock_disponible_db
        return sum(item.disponible for item in obj.stocks.all())

    def get_total_stock(self, obj):
        return self.get_total_stock_disponible(obj)

    def create(self, validated_data):
        initial_stock = validated_data.pop('initial_stock', 0)
        product = create_product(validated_data, initial_stock)
        return product


class TicketReservationSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ('id', 'folio', 'estado')


class StockReservationSerializer(serializers.ModelSerializer):
    stock_item = StockItemSerializer(read_only=True)
    stock_item_id = serializers.PrimaryKeyRelatedField(
        queryset=StockItem.objects.annotate(
            available_db=ExpressionWrapper(F('cantidad') - F('reservado'), output_field=DecimalField(max_digits=12, decimal_places=3))
        ),
        source='stock_item',
        write_only=True,
    )
    ticket = TicketReservationSummarySerializer(read_only=True)
    ticket_id = serializers.PrimaryKeyRelatedField(queryset=Ticket.objects.all(), source='ticket', write_only=True)
    reservado_por_nombre = serializers.ReadOnlyField(source='reservado_por.nombre')

    class Meta:
        model = StockReservation
        fields = (
            'id',
            'stock_item',
            'stock_item_id',
            'ticket',
            'ticket_id',
            'cantidad',
            'estado',
            'reservado_por',
            'reservado_por_nombre',
            'notas',
            'entregado_el',
            'entregado_por',
            'consumido_el',
            'liberado_el',
            'created_at',
        )
        read_only_fields = (
            'estado', 'reservado_por', 'entregado_el', 'entregado_por',
            'consumido_el', 'liberado_el', 'created_at'
        )


class InventoryMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.nombre')
    product_code = serializers.ReadOnlyField(source='product.codigo')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.nombre')
    destination_warehouse_name = serializers.ReadOnlyField(source='destination_warehouse.nombre')
    created_by_name = serializers.ReadOnlyField(source='created_by.nombre')

    class Meta:
        model = InventoryMovement
        fields = (
            'id',
            'product',
            'product_name',
            'product_code',
            'warehouse',
            'warehouse_name',
            'destination_warehouse',
            'destination_warehouse_name',
            'movement_type',
            'quantity',
            'unit_cost',
            'total_cost',
            'reference_type',
            'reference_id',
            'serial_numbers',
            'notes',
            'created_by',
            'created_by_name',
            'created_at',
        )
