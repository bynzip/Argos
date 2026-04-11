from rest_framework import serializers
from .models import Category, Brand, Warehouse, Product, StockItem
from apps.core.models import FolioCounter

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

    def get_total_stock(self, obj):
        # Preferir el valor calculado por la base de datos (anotado en el ViewSet)
        if hasattr(obj, 'total_stock_db'):
            return obj.total_stock_db
        # Fallback por si se accede al serializador fuera del ViewSet optimizado
        return sum(item.cantidad for item in obj.stocks.all())

    def create(self, validated_data):
        initial_stock = validated_data.pop('initial_stock', 0)
        
        # Autogeneración de folio único para el producto
        if not validated_data.get('codigo'):
            validated_data['codigo'] = FolioCounter.get_next_folio('PROD')
        
        product = super().create(validated_data)

        # Si hay stock inicial, lo asignamos al almacén principal
        if initial_stock > 0:
            warehouse, _ = Warehouse.objects.get_or_create(
                nombre="Almacén Principal",
                defaults={"ubicacion": "Sede Central"}
            )
            StockItem.objects.create(
                product=product,
                warehouse=warehouse,
                cantidad=initial_stock
            )
            
        return product
