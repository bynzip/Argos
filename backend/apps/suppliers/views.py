from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.products.models import Warehouse
from apps.users.permissions import RolePermission

from .models import PurchaseOrder, Supplier
from .serializers import PurchaseOrderSerializer, SupplierSerializer
from .services import (
    cancel_purchase_order,
    create_supplier_order,
    get_purchase_suggestions,
    receive_purchase_order,
    send_purchase_order,
    update_supplier_order,
)


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.filter(deleted_at__isnull=True).order_by('nombre')
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['suppliers.view'],
        'retrieve': ['suppliers.view'],
        'create': ['suppliers.create'],
        'update': ['suppliers.edit'],
        'partial_update': ['suppliers.edit'],
        'destroy': ['suppliers.edit'],
    }

    def perform_destroy(self, instance):
        instance.delete()


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.select_related(
        'supplier', 'destination_warehouse', 'created_by'
    ).prefetch_related('items__product', 'status_history')
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['suppliers.manage_orders'],
        'retrieve': ['suppliers.manage_orders'],
        'create': ['suppliers.manage_orders'],
        'update': ['suppliers.manage_orders'],
        'partial_update': ['suppliers.manage_orders'],
        'send_order': ['suppliers.manage_orders'],
        'receive_order': ['suppliers.manage_orders'],
        'cancel_order': ['suppliers.manage_orders'],
        'suggestions': ['suppliers.manage_orders'],
    }

    def _serialize_purchase_order(self, purchase_order):
        refreshed_order = self.get_queryset().get(pk=purchase_order.pk)
        return self.get_serializer(refreshed_order).data

    def create(self, request, *args, **kwargs):
        supplier = Supplier.objects.get(pk=request.data.get('supplier'))
        destination_warehouse = Warehouse.objects.get(pk=request.data.get('destination_warehouse'))
        purchase_order = create_supplier_order(
            user=request.user,
            supplier=supplier,
            destination_warehouse=destination_warehouse,
            items=request.data.get('items', []),
            notes=request.data.get('notes', ''),
        )
        return Response(self._serialize_purchase_order(purchase_order), status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        purchase_order = self.get_object()
        supplier = Supplier.objects.get(pk=request.data.get('supplier'))
        destination_warehouse = Warehouse.objects.get(pk=request.data.get('destination_warehouse'))
        updated_order = update_supplier_order(
            purchase_order=purchase_order,
            user=request.user,
            supplier=supplier,
            destination_warehouse=destination_warehouse,
            items=request.data.get('items', []),
            notes=request.data.get('notes', ''),
        )
        return Response(self._serialize_purchase_order(updated_order))

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def send_order(self, request, pk=None):
        purchase_order = send_purchase_order(purchase_order=self.get_object(), user=request.user, notes=request.data.get('notes', ''))
        return Response(self._serialize_purchase_order(purchase_order))

    @action(detail=True, methods=['post'])
    def receive_order(self, request, pk=None):
        purchase_order = receive_purchase_order(
            purchase_order=self.get_object(),
            user=request.user,
            items=request.data.get('items', []),
            notes=request.data.get('notes', ''),
            close_incomplete=bool(request.data.get('close_incomplete', False)),
        )
        return Response(self._serialize_purchase_order(purchase_order))

    @action(detail=True, methods=['post'])
    def cancel_order(self, request, pk=None):
        purchase_order = cancel_purchase_order(purchase_order=self.get_object(), user=request.user, notes=request.data.get('notes', ''))
        return Response(self._serialize_purchase_order(purchase_order))

    @action(detail=False, methods=['get'])
    def suggestions(self, request):
        return Response(get_purchase_suggestions())
