from django_filters.rest_framework import DjangoFilterBackend
import json
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.customers.models import Customer, Device
from apps.users.permissions import RolePermission

from apps.users.models import Subarea

from .models import ChecklistTemplate, Ticket, TicketAccessory, TicketChecklistItem, TicketEvidence
from .serializers import ChecklistTemplateSerializer, TicketDetailSerializer, TicketListSerializer
from .services import (
    apply_checklist_template,
    assign_ticket,
    create_checklist_template,
    create_ticket,
    create_checklist_item,
    create_warranty_ticket,
    move_ticket_subarea,
    parse_accessories_payload,
    parse_evidence_ids_payload,
    transition_ticket,
    update_checklist_template,
    update_checklist_item,
    update_ticket_technical_details,
    validate_evidence_files,
    validate_ticket_device_customer,
)
from .services.ticket_service import update_ticket_amounts
from apps.quotes.services import create_quick_quote_for_ticket


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
        'update_technical_details': ['tickets.transition_technical'],
        'add_checklist_item': ['tickets.transition_technical'],
        'update_checklist_item': ['tickets.transition_technical'],
        'move_subarea': ['tickets.transition_technical'],
        'create_warranty': ['tickets.create'],
        'assign_quick_amount': ['quotes.create'],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'folio', 'customer__nombre', 'customer__identificador',
        'device__modelo', 'device__marca', 'device__numero_serie'
    ]
    filterset_fields = ['prioridad', 'assigned_to', 'subarea']
    ordering_fields = ['created_at', 'prioridad']

    def get_queryset(self):
        user = self.request.user
        estados = self.request.query_params.getlist('estado')
        if len(estados) == 1 and estados[0] and ',' in estados[0]:
            estados = [estado.strip() for estado in estados[0].split(',') if estado.strip()]

        if user.is_superuser:
            queryset = Ticket.objects.all().order_by('-created_at')
            if estados:
                queryset = queryset.filter(estado__in=estados)
            return queryset

        user_perms = user.get_permission_codes()
        if 'tickets.view_list' in user_perms:
            queryset = Ticket.objects.all().order_by('-created_at')
            if estados:
                queryset = queryset.filter(estado__in=estados)
            return queryset
        if 'tickets.view_own' in user_perms:
            queryset = Ticket.objects.filter(assigned_to=user).order_by('-created_at')
            if estados:
                queryset = queryset.filter(estado__in=estados)
            return queryset
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

        return Response(self.get_serializer(ticket).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        ticket = self.get_object()
        new_status = request.data.get('new_status')
        motivo = request.data.get('motivo')

        if not new_status:
            return Response({'detail': 'new_status es obligatorio'}, status=status.HTTP_400_BAD_REQUEST)

        ticket = transition_ticket(ticket=ticket, new_status=new_status, user=request.user, motivo=motivo)
        return Response(self.get_serializer(ticket).data)

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
        return Response(self.get_serializer(ticket).data)

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
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=['patch'])
    def update_technical_details(self, request, pk=None):
        ticket = self.get_object()
        ticket = update_ticket_technical_details(
            ticket=ticket,
            user=request.user,
            diagnostico=request.data.get('diagnostico'),
            solucion=request.data.get('solucion'),
        )
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=['post'])
    def add_checklist_item(self, request, pk=None):
        ticket = self.get_object()
        nombre = (request.data.get('nombre') or '').strip()
        if not nombre:
            return Response({'detail': 'nombre es obligatorio'}, status=status.HTTP_400_BAD_REQUEST)
        validate_evidence_files(request.FILES.getlist('evidences'))

        create_checklist_item(
            ticket=ticket,
            user=request.user,
            nombre=nombre,
            requerido=str(request.data.get('requerido', 'true')).lower() != 'false',
            notas=request.data.get('notas', ''),
            orden=int(request.data.get('orden', 0) or 0),
            evidence_files=request.FILES.getlist('evidences'),
        )
        ticket.refresh_from_db()
        return Response(self.get_serializer(ticket).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'checklist-items/(?P<checklist_id>[^/.]+)')
    def update_checklist_item(self, request, pk=None, checklist_id=None):
        ticket = self.get_object()
        try:
            checklist_item = TicketChecklistItem.objects.get(ticket=ticket, pk=checklist_id)
        except TicketChecklistItem.DoesNotExist:
            return Response({'detail': 'Item de checklist no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        if request.method.lower() == 'delete':
            checklist_item.delete()
            ticket.refresh_from_db()
            return Response(self.get_serializer(ticket).data, status=status.HTTP_200_OK)

        completado_raw = request.data.get('completado')
        completado = None
        if completado_raw is not None:
            completado = str(completado_raw).lower() in {'1', 'true', 'yes', 'si'}
        validate_evidence_files(request.FILES.getlist('evidences'))

        update_checklist_item(
            checklist_item=checklist_item,
            user=request.user,
            completado=completado,
            notas=request.data.get('notas'),
            evidence_files=request.FILES.getlist('evidences'),
        )
        ticket.refresh_from_db()
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=['patch'])
    def move_subarea(self, request, pk=None):
        ticket = self.get_object()
        subarea_id = request.data.get('subarea_id')
        try:
            subarea = Subarea.objects.get(pk=subarea_id) if subarea_id else None
        except Subarea.DoesNotExist:
            return Response({'detail': 'Subarea no encontrada'}, status=status.HTTP_400_BAD_REQUEST)

        move_ticket_subarea(
            ticket=ticket,
            subarea=subarea,
            user=request.user,
            notas=request.data.get('notas', ''),
        )
        ticket.refresh_from_db()
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=['post'])
    def create_warranty(self, request, pk=None):
        ticket = self.get_object()
        descripcion_problema = (request.data.get('descripcion_problema') or '').strip()
        if not descripcion_problema:
            return Response({'detail': 'descripcion_problema es obligatorio'}, status=status.HTTP_400_BAD_REQUEST)

        accessories = parse_accessories_payload(request.data.get('accessories'))
        inherited_evidence_ids = parse_evidence_ids_payload(request.data.get('inherited_evidence_ids'))
        files = request.FILES.getlist('evidences')
        validate_evidence_files(files)

        warranty_ticket = create_warranty_ticket(
            source_ticket=ticket,
            user=request.user,
            descripcion_problema=descripcion_problema,
            prioridad=request.data.get('prioridad') or ticket.prioridad,
            accessories=accessories,
            inherited_evidence_ids=inherited_evidence_ids,
            evidence_files=files,
        )
        return Response(self.get_serializer(warranty_ticket).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def assign_quick_amount(self, request, pk=None):
        ticket = self.get_object()
        quote = create_quick_quote_for_ticket(
            ticket=ticket,
            user=request.user,
            lines=request.data.get('lines'),
            descuento=request.data.get('descuento', 0),
            igv_rate=request.data.get('igv_rate'),
        )
        ticket.refresh_from_db()
        return Response(
            {
                'ticket': self.get_serializer(ticket).data,
                'quote': {
                    'id': quote.id,
                    'folio': quote.folio,
                    'estado': quote.estado,
                    'total': str(quote.total),
                },
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def apply_checklist_template(self, request, pk=None):
        ticket = self.get_object()
        template_id = request.data.get('template_id')
        try:
            template = ChecklistTemplate.objects.prefetch_related('items').get(pk=template_id, activo=True)
        except ChecklistTemplate.DoesNotExist:
            return Response({'detail': 'Plantilla no encontrada'}, status=status.HTTP_404_NOT_FOUND)

        apply_checklist_template(ticket=ticket, template=template, user=request.user)
        ticket.refresh_from_db()
        return Response(self.get_serializer(ticket).data)


class ChecklistTemplateViewSet(viewsets.ModelViewSet):
    queryset = ChecklistTemplate.objects.prefetch_related('items').all().order_by('nombre')
    serializer_class = ChecklistTemplateSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['tickets.transition_technical', 'tickets.view_detail'],
        'retrieve': ['tickets.transition_technical', 'tickets.view_detail'],
        'create': ['config.edit'],
        'update': ['config.edit'],
        'partial_update': ['config.edit'],
        'destroy': ['config.edit'],
    }

    def create(self, request, *args, **kwargs):
        nombre = (request.data.get('nombre') or '').strip()
        if not nombre:
            return Response({'detail': 'nombre es obligatorio'}, status=status.HTTP_400_BAD_REQUEST)
        items = request.data.get('items') or []
        if isinstance(items, str):
            try:
                items = json.loads(items)
            except json.JSONDecodeError:
                return Response({'detail': 'items debe ser una lista valida'}, status=status.HTTP_400_BAD_REQUEST)
        template = create_checklist_template(
            user=request.user,
            nombre=nombre,
            descripcion=request.data.get('descripcion', ''),
            items=items,
        )
        return Response(self.get_serializer(template).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        items = request.data.get('items')
        if isinstance(items, str):
            try:
                items = json.loads(items)
            except json.JSONDecodeError:
                return Response({'detail': 'items debe ser una lista valida'}, status=status.HTTP_400_BAD_REQUEST)
        template = update_checklist_template(
            template=self.get_object(),
            user=request.user,
            nombre=request.data.get('nombre'),
            descripcion=request.data.get('descripcion'),
            activo=request.data.get('activo'),
            items=items,
        )
        return Response(self.get_serializer(template).data)
