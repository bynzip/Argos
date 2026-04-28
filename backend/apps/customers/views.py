from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import RolePermission
from django_filters.rest_framework import DjangoFilterBackend

from .models import Customer, Device
from .serializers import CustomerListSerializer, CustomerDetailSerializer, DeviceSerializer
from .services import register_device

class CustomerViewSet(viewsets.ModelViewSet):
    """
    CRUD de Clientes con Soft Delete y Búsqueda Avanzada.
    """
    queryset = Customer.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['customers.view_list'],
        'retrieve': ['customers.view_detail'],
        'create': ['customers.create'],
        'update': ['customers.edit'],
        'partial_update': ['customers.edit'],
        'destroy': ['customers.deactivate'],
        'devices': ['devices.view_list', 'devices.create'],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    # Búsqueda en tiempo real (por DNI/RUC, nombre, teléfono o correo)
    search_fields = ['identificador', 'nombre', 'telefono', 'correo_electronico']
    
    # Filtros exactos (por etiqueta, tipo_cliente)
    filterset_fields = ['etiqueta', 'tipo_cliente', 'is_active']
    
    # Ordenamiento
    ordering_fields = ['nombre', 'created_at']

    def get_serializer_class(self):
        # Utilizar un serializer más pesado/completo solo cuando se pide el detalle
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return CustomerDetailSerializer
        return CustomerListSerializer
        
    def perform_destroy(self, instance):
        # El soft delete se delega al modelo gracias al custom manager y override de delete()
        instance.delete()

    @action(detail=True, methods=['get', 'post'])
    def devices(self, request, pk=None):
        """
        Endpoint anidado para listar o registrar dispositivos de un cliente:
        GET /api/customers/{id}/devices/ -> Lista dispositivos del cliente
        POST /api/customers/{id}/devices/ -> Registra dispositivo nuevo para el cliente
        """
        customer = self.get_object()
        
        if request.method == 'GET':
            # Filtrar dispositivos activos que pertenecen a este cliente
            devices = Device.objects.filter(customer=customer)
            serializer = DeviceSerializer(devices, many=True)
            return Response(serializer.data)
            
        elif request.method == 'POST':
            # Crear un nuevo dispositivo
            serializer = DeviceSerializer(data=request.data)
            if serializer.is_valid():
                device = register_device(customer, serializer.validated_data)
                result_serializer = DeviceSerializer(device)
                return Response(result_serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DeviceViewSet(viewsets.ModelViewSet):
    """
    CRUD directo para editar o hacer soft delete a dispositivos ya creados.
    (La creación ocurre preferiblemente a través del endpoint anidado del cliente).
    """
    queryset = Device.objects.all().order_by('-created_at')
    serializer_class = DeviceSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['devices.view_list'],
        'retrieve': ['devices.view_list'],
        'update': ['devices.edit'],
        'partial_update': ['devices.edit'],
        'destroy': ['devices.edit'],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['marca', 'modelo', 'numero_serie']
    filterset_fields = ['tipo_equipo', 'is_active']

    def perform_destroy(self, instance):
        # Soft delete del dispositivo
        instance.delete()
