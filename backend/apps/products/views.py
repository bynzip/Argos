from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from apps.tickets.views import TicketPagination
from apps.users.permissions import RolePermission

from .models import Category, Brand, InventoryMovement, Product, ProductSupplier, StockItem, StockReservation, Warehouse
from .serializers import (
    BrandSerializer,
    CategorySerializer,
    InventoryMovementSerializer,
    ProductSerializer,
    ProductSupplierSerializer,
    StockItemSerializer,
    StockReservationSerializer,
    WarehouseSerializer,
)
from .services import adjust_stock, consume_reservation, deliver_reservation, release_reservation, reserve_stock, transfer_stock


PRODUCT_ANNOTATIONS = {
    'total_stock_fisico_db': Coalesce(Sum('stocks__cantidad'), 0, output_field=DecimalField(max_digits=12, decimal_places=3)),
    'total_stock_reservado_db': Coalesce(Sum('stocks__reservado'), 0, output_field=DecimalField(max_digits=12, decimal_places=3)),
    'total_stock_disponible_db': ExpressionWrapper(
        Coalesce(Sum('stocks__cantidad'), 0, output_field=DecimalField(max_digits=12, decimal_places=3))
        - Coalesce(Sum('stocks__reservado'), 0, output_field=DecimalField(max_digits=12, decimal_places=3)),
        output_field=DecimalField(max_digits=12, decimal_places=3),
    ),
}


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.filter(activo=True)
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['inventory.view_catalog'],
        'retrieve': ['inventory.view_catalog'],
        'create': ['inventory.create_product'],
        'update': ['inventory.edit_product'],
        'partial_update': ['inventory.edit_product'],
        'destroy': ['inventory.deactivate_product'],
    }


class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.filter(activo=True)
    serializer_class = BrandSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['inventory.view_catalog'],
        'retrieve': ['inventory.view_catalog'],
        'create': ['inventory.create_product'],
        'update': ['inventory.edit_product'],
        'partial_update': ['inventory.edit_product'],
        'destroy': ['inventory.deactivate_product'],
    }


class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.none()
    serializer_class = WarehouseSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['inventory.view_catalog'],
        'retrieve': ['inventory.view_catalog'],
        'create': ['inventory.manage_movements'],
        'update': ['inventory.manage_movements'],
        'partial_update': ['inventory.manage_movements'],
        'destroy': ['inventory.manage_movements'],
        'restore': ['inventory.manage_movements'],
        'hard_delete': ['inventory.manage_movements'],
    }

    def get_queryset(self):
        include_inactive = self.request.query_params.get('include_inactive')
        manager = Warehouse.all_objects if include_inactive == 'true' else Warehouse.objects
        return manager.all().order_by('nombre')

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        warehouse = get_object_or_404(Warehouse.all_objects.all(), pk=pk)
        warehouse.restore()
        serializer = self.get_serializer(warehouse)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def hard_delete(self, request, pk=None):
        warehouse = get_object_or_404(Warehouse.all_objects.all(), pk=pk)
        if warehouse.deleted_at is None:
            raise ValidationError('Solo se pueden eliminar almacenes desactivados.')
        if warehouse.stock_items.exists():
            raise ValidationError('Vacía el almacén antes de eliminarlo.')
        if warehouse.inventory_movements.exists() or warehouse.incoming_inventory_movements.exists():
            raise ValidationError('No se puede eliminar un almacén con historial de movimientos.')
        warehouse.hard_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.annotate(**PRODUCT_ANNOTATIONS).prefetch_related('stocks__warehouse', 'product_suppliers__supplier').order_by('-created_at')
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    pagination_class = TicketPagination
    required_permissions = {
        'list': ['inventory.view_catalog'],
        'retrieve': ['inventory.view_catalog'],
        'create': ['inventory.create_product'],
        'update': ['inventory.edit_product'],
        'partial_update': ['inventory.edit_product'],
        'destroy': ['inventory.deactivate_product'],
        'kardex': ['inventory.view_stock'],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['codigo', 'nombre', 'brand__nombre', 'descripcion']
    filterset_fields = ['category', 'brand', 'activo']
    ordering_fields = ['nombre', 'precio_venta', 'created_at']

    def get_queryset(self):
        queryset = super().get_queryset()
        low_stock = self.request.query_params.get('low_stock')
        if low_stock == 'true':
            queryset = queryset.filter(total_stock_disponible_db__lte=F('stock_minimo'))
        return queryset

    @action(detail=True, methods=['get'])
    def kardex(self, request, pk=None):
        product = self.get_object()
        queryset = InventoryMovement.objects.filter(product=product).select_related(
            'warehouse', 'destination_warehouse', 'product', 'created_by'
        ).order_by('-created_at')
        page = self.paginate_queryset(queryset)
        serializer = InventoryMovementSerializer(page or queryset, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


class StockItemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockItem.objects.select_related('product', 'warehouse').all()
    serializer_class = StockItemSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    pagination_class = TicketPagination
    required_permissions = {
        'list': ['inventory.view_stock'],
        'retrieve': ['inventory.view_stock'],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['product', 'warehouse']
    search_fields = ['product__nombre', 'product__codigo', 'warehouse__nombre']
    ordering_fields = ['cantidad', 'reservado', 'updated_at']

    def get_queryset(self):
        queryset = StockItem.objects.select_related('product', 'warehouse').annotate(
            available_db=ExpressionWrapper(
                F('cantidad') - F('reservado'),
                output_field=DecimalField(max_digits=12, decimal_places=3),
            )
        ).order_by('product__nombre', 'warehouse__nombre')
        available_only = self.request.query_params.get('available_only')
        if available_only == 'true':
            queryset = queryset.filter(cantidad__gt=F('reservado'))
        return queryset


class StockReservationViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet
):
    serializer_class = StockReservationSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    pagination_class = TicketPagination
    required_permissions = {
        'list': ['inventory.view_stock'],
        'retrieve': ['inventory.view_stock'],
        'create': ['inventory.reserve_stock'],
        'deliver': ['inventory.reserve_stock'],
        'release': ['inventory.reserve_stock'],
        'consume': ['inventory.reserve_stock'],
    }
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['ticket', 'estado', 'stock_item']
    ordering_fields = ['created_at', 'consumido_el', 'liberado_el']

    def get_queryset(self):
        return StockReservation.objects.select_related(
            'stock_item__product', 'stock_item__warehouse', 'ticket', 'reservado_por'
        ).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reservation = reserve_stock(
            stock_item=serializer.validated_data['stock_item'],
            ticket=serializer.validated_data['ticket'],
            quantity=serializer.validated_data['cantidad'],
            user=request.user,
            notes=serializer.validated_data.get('notas', ''),
        )
        response_data = self.get_serializer(reservation).data
        if getattr(reservation, 'was_partial', False):
            response_data.update({
                'was_partial': True,
                'requested_quantity': str(reservation.requested_quantity),
                'missing_quantity': str(reservation.missing_quantity),
                'detail': (
                    f"Reserva parcial creada. Se reservaron {reservation.cantidad} de "
                    f"{reservation.requested_quantity}."
                ),
            })
        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def deliver(self, request, pk=None):
        reservation = deliver_reservation(
            reservation=self.get_object(),
            user=request.user,
            notes=request.data.get('notes', '') or request.data.get('notas', ''),
        )
        return Response(self.get_serializer(reservation).data)

    @action(detail=True, methods=['post'])
    def release(self, request, pk=None):
        reservation = release_reservation(
            reservation=self.get_object(),
            user=request.user,
            notes=request.data.get('notes', '') or request.data.get('notas', ''),
        )
        return Response(self.get_serializer(reservation).data)

    @action(detail=True, methods=['post'])
    def consume(self, request, pk=None):
        reservation = consume_reservation(
            reservation=self.get_object(),
            user=request.user,
            notes=request.data.get('notes', '') or request.data.get('notas', ''),
        )
        return Response(self.get_serializer(reservation).data)


class InventoryMovementViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = InventoryMovementSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    pagination_class = TicketPagination
    required_permissions = {
        'list': ['inventory.view_stock'],
        'retrieve': ['inventory.view_stock'],
        'adjust': ['inventory.adjust_stock'],
        'transfer': ['inventory.transfer_stock'],
    }
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['product', 'warehouse', 'movement_type', 'reference_type']
    ordering_fields = ['created_at', 'quantity']

    def get_queryset(self):
        queryset = InventoryMovement.objects.select_related(
            'product', 'warehouse', 'destination_warehouse', 'created_by'
        ).order_by('-created_at')
        reference_id = self.request.query_params.get('reference_id')
        if reference_id:
            queryset = queryset.filter(reference_id=reference_id)
        return queryset

    @action(detail=False, methods=['post'])
    def adjust(self, request):
        stock_item_id = request.data.get('stock_item')
        movement_type = request.data.get('movement_type')
        quantity = request.data.get('quantity')
        notes = request.data.get('notes') or request.data.get('notas')
        unit_cost = request.data.get('unit_cost')

        if not stock_item_id or not movement_type or quantity is None:
            return Response(
                {'detail': 'stock_item, movement_type y quantity son obligatorios.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            stock_item = StockItem.objects.get(pk=stock_item_id)
        except StockItem.DoesNotExist:
            return Response({'detail': 'StockItem no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        stock_item = adjust_stock(
            stock_item=stock_item,
            movement_type=movement_type,
            quantity=quantity,
            user=request.user,
            notes=notes,
            unit_cost=unit_cost,
        )
        return Response(StockItemSerializer(stock_item, context={'request': request}).data)

    @action(detail=False, methods=['post'])
    def transfer(self, request):
        source_stock_item_id = request.data.get('source_stock_item')
        destination_warehouse_id = request.data.get('destination_warehouse')
        quantity = request.data.get('quantity')
        notes = request.data.get('notes') or request.data.get('notas', '')

        if not source_stock_item_id or not destination_warehouse_id or quantity is None:
            return Response(
                {'detail': 'source_stock_item, destination_warehouse y quantity son obligatorios.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            stock_item = StockItem.objects.get(pk=source_stock_item_id)
            destination_warehouse = Warehouse.objects.get(pk=destination_warehouse_id)
        except StockItem.DoesNotExist:
            return Response({'detail': 'StockItem origen no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        except Warehouse.DoesNotExist:
            return Response({'detail': 'Almacén destino no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        source, destination = transfer_stock(
            source_stock_item=stock_item,
            destination_warehouse=destination_warehouse,
            quantity=quantity,
            user=request.user,
            notes=notes,
        )
        return Response({
            'source': StockItemSerializer(source, context={'request': request}).data,
            'destination': StockItemSerializer(destination, context={'request': request}).data,
        })


class ProductSupplierViewSet(viewsets.ModelViewSet):
    queryset = ProductSupplier.objects.select_related('product', 'supplier').order_by('product__nombre', 'supplier__nombre')
    serializer_class = ProductSupplierSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['inventory.view_catalog'],
        'retrieve': ['inventory.view_catalog'],
        'create': ['inventory.edit_product'],
        'update': ['inventory.edit_product'],
        'partial_update': ['inventory.edit_product'],
        'destroy': ['inventory.edit_product'],
    }
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['product', 'supplier']
    ordering_fields = ['created_at', 'lead_time_days', 'supplier_price']
