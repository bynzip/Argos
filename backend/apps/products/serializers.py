from rest_framework import serializers
from .models import Category, Brand, Warehouse, Product, StockItem
from apps.core.models import FolioCounter
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

class StockItemSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.ReadOnlyField(source='warehouse.nombre')
    
    class Meta:
        model = StockItem
        fields = ('id', 'warehouse', 'warehouse_name', 'cantidad', 'ubicacion_especifica')

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.nombre')
    brand_name = serializers.ReadOnlyField(source='brand.nombre')
    stocks = StockItemSerializer(many=True, read_only=True)
    total_stock = serializers.SerializerMethodField()
    initial_stock = serializers.IntegerField(write_only=True, required=False, default=0)

    class Meta:
        model = Product
        fields = (
            'id', 'codigo', 'nombre', 'descripcion', 'category', 'category_name',
            'brand', 'brand_name', 'precio_costo', 'precio_venta', 
            'stock_minimo', 'activo', 'total_stock', 'stocks', 'created_at',
            'initial_stock'
        )
        read_only_fields = ('id', 'codigo', 'created_at')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        
        # RN-15: Los precios de costo son invisibles para recepcionistas y técnicos
        if request and request.user.is_authenticated and not request.user.is_superuser:
            role = request.user.user_roles.first().role.nombre if request.user.user_roles.exists() else ''
            if role not in ['Administrador', 'Almacenero']:
                data.pop('precio_costo', None)
                
        return data

    def get_total_stock(self, obj):
        # Preferir el valor calculado por la base de datos (anotado en el ViewSet)
        if hasattr(obj, 'total_stock_db'):
            return obj.total_stock_db
        # Fallback por si se accede al serializador fuera del ViewSet optimizado
        return sum(item.cantidad for item in obj.stocks.all())

    def create(self, validated_data):
        initial_stock = validated_data.pop('initial_stock', 0)
        product = create_product(validated_data, initial_stock)
        return product
