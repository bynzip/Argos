from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.customers.models import Customer, Device
from apps.users.permissions import RolePermission

from .models import Ticket, TicketAccessory, TicketEvidence
from .serializers import TicketDetailSerializer, TicketListSerializer
from .services import (
    assign_ticket,
    create_ticket,
    parse_accessories_payload,
    transition_ticket,
    validate_evidence_files,
    validate_ticket_device_customer,
)
from .services.ticket_service import update_ticket_amounts


class TicketPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class TicketViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RolePermission]
    pagination_class = TicketPagination
    required_permissions = {
        'list': ['tickets.view_list', 'tickets.view_own'],
        'retrieve': ['tickets.view_detail', 'tickets.view_readonly'],
        'create': ['tickets.create'],
        'update': ['tickets.transition_technical', 'tickets.transition_reception'],
        'partial_update': ['tickets.transition_technical', 'tickets.transition_reception'],
        'destroy': ['tickets.view_list'],
        'transition': ['tickets.transition_technical', 'tickets.transition_reception'],
        'assign': ['tickets.assign_technician'],
        'update_amounts': ['tickets.transition_technical', 'tickets.transition_reception'],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'folio', 'customer__nombre', 'customer__identificador',
        'device__modelo', 'device__marca', 'device__numero_serie'
    ]
    filterset_fields = ['estado', 'prioridad', 'assigned_to', 'subarea']
    ordering_fields = ['created_at', 'prioridad']

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Ticket.objects.all().order_by('-created_at')

        user_perms = user.get_permission_codes()
        if 'tickets.view_list' in user_perms:
            return Ticket.objects.all().order_by('-created_at')
        if 'tickets.view_own' in user_perms:
            return Ticket.objects.filter(assigned_to=user).order_by('-created_at')
        return Ticket.objects.none()

    def get_serializer_class(self):
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return TicketDetailSerializer
        return TicketListSerializer

    def create(self, request, *args, **kwargs):
        data = request.data
        customer_id = data.get('customer_id')
        device_id = data.get('device_id')
        descripcion_problema = data.get('descripcion_problema')
        prioridad = data.get('prioridad', Ticket.TicketPriority.LOW)

        if not customer_id or not descripcion_problema:
            return Response(
                {"detail": "customer_id y descripcion_problema son obligatorios"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            customer = Customer.objects.get(id=customer_id)
        except Customer.DoesNotExist:
            return Response({"detail": "Cliente no encontrado"}, status=status.HTTP_400_BAD_REQUEST)

        device = None
        if device_id:
            try:
                device = Device.objects.get(id=device_id)
            except Device.DoesNotExist:
                return Response({"detail": "Dispositivo no encontrado"}, status=status.HTTP_400_BAD_REQUEST)

        validate_ticket_device_customer(customer, device)
        accessories = parse_accessories_payload(data.get('accessories'))
        files = request.FILES.getlist('evidences')
        validate_evidence_files(files)

        ticket = create_ticket(
            customer=customer,
            user=request.user,
            descripcion_problema=descripcion_problema,
            device=device,
            prioridad=prioridad
        )

        for acc in accessories:
            TicketAccessory.objects.create(
                ticket=ticket,
                nombre=acc['nombre'],
                condicion=acc.get('condicion'),
                notas=acc.get('notas')
            )

        for file_obj in files:
            TicketEvidence.objects.create(
                ticket=ticket,
                archivo=file_obj,
                nombre_archivo=file_obj.name,
                tamano_archivo=file_obj.size,
                tipo_archivo=file_obj.content_type,
                subido_por=request.user
            )

        return Response(TicketDetailSerializer(ticket).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        ticket = self.get_object()
        new_status = request.data.get('new_status')
        motivo = request.data.get('motivo')

        if not new_status:
            return Response({'detail': 'new_status es obligatorio'}, status=status.HTTP_400_BAD_REQUEST)

        ticket = transition_ticket(ticket=ticket, new_status=new_status, user=request.user, motivo=motivo)
        return Response(TicketDetailSerializer(ticket).data)

    @action(detail=True, methods=['patch'])
    def assign(self, request, pk=None):
        ticket = self.get_object()
        user_id = request.data.get('user_id')

        from apps.users.models import User

        try:
            technician = User.objects.get(id=user_id) if user_id else None
        except User.DoesNotExist:
            return Response({'detail': 'Técnico no encontrado'}, status=status.HTTP_400_BAD_REQUEST)

        ticket = assign_ticket(ticket, technician, request.user)
        return Response(TicketDetailSerializer(ticket).data)

    @action(detail=True, methods=['patch'])
    def update_amounts(self, request, pk=None):
        ticket = self.get_object()
        monto_estimado = request.data.get('monto_estimado')
        total = request.data.get('total')
        motivo = request.data.get('motivo', 'Actualización de montos')

        ticket = update_ticket_amounts(
            ticket=ticket,
            user=request.user,
            monto_estimado=monto_estimado,
            total=total,
            motivo=motivo
        )
        return Response(TicketDetailSerializer(ticket).data)
