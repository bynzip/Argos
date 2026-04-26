import json
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.core.exceptions import ValidationError

from .models import Ticket, TicketAccessory, TicketEvidence
from .serializers import (
    TicketListSerializer, TicketDetailSerializer, TicketEvidenceSerializer
)
from .services import create_ticket, transition_ticket, assign_ticket
from apps.customers.models import Customer, Device

class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    search_fields = ['folio', 'customer__nombre', 'device__modelo']
    filterset_fields = ['estado', 'prioridad', 'assigned_to', 'subarea']
    ordering_fields = ['created_at', 'prioridad']

    def get_serializer_class(self):
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return TicketDetailSerializer
        return TicketListSerializer

    def create(self, request, *args, **kwargs):
        # Note: Since we have file uploads, data might come as multipart/form-data
        data = request.data
        
        customer_id = data.get('customer_id')
        device_id = data.get('device_id')
        descripcion_problema = data.get('descripcion_problema')
        prioridad = data.get('prioridad', Ticket.TicketPriority.LOW)
        
        if not customer_id or not descripcion_problema:
            return Response({"detail": "customer_id y descripcion_problema son obligatorios"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            customer = Customer.objects.get(id=customer_id)
        except Customer.DoesNotExist:
            return Response({"detail": "Cliente no encontrado"}, status=status.HTTP_400_BAD_REQUEST)
            
        device = None
        if device_id:
            try:
                device = Device.objects.get(id=device_id)
            except Device.DoesNotExist:
                pass
                
        ticket = create_ticket(
            customer=customer,
            user=request.user,
            descripcion_problema=descripcion_problema,
            device=device,
            prioridad=prioridad
        )
        
        # Accesorios can be sent as a JSON string in multipart form data
        accessories_str = data.get('accessories')
        if accessories_str:
            try:
                accessories = json.loads(accessories_str)
                for acc in accessories:
                    TicketAccessory.objects.create(
                        ticket=ticket,
                        nombre=acc.get('nombre'),
                        condicion=acc.get('condicion'),
                        notas=acc.get('notas')
                    )
            except Exception:
                pass # Or handle invalid json
                
        # Handle files
        files = request.FILES.getlist('evidences')
        for f in files:
            TicketEvidence.objects.create(
                ticket=ticket,
                archivo=f,
                nombre_archivo=f.name,
                tamano_archivo=f.size,
                tipo_archivo=f.content_type,
                subido_por=request.user
            )
            
        result_serializer = TicketDetailSerializer(ticket)
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        ticket = self.get_object()
        new_status = request.data.get('new_status')
        motivo = request.data.get('motivo')
        
        if not new_status:
            return Response({'detail': 'new_status es obligatorio'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            ticket = transition_ticket(
                ticket=ticket,
                new_status=new_status,
                user=request.user,
                motivo=motivo
            )
            return Response(TicketDetailSerializer(ticket).data)
        except ValidationError as e:
            # Django's ValidationError converts to a string representation that may be unwieldy, 
            # let's just return the first message or the string.
            return Response({'detail': e.message if hasattr(e, 'message') else str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
    @action(detail=True, methods=['patch'])
    def assign(self, request, pk=None):
        ticket = self.get_object()
        user_id = request.data.get('user_id')
        try:
            from apps.users.models import User
            technician = User.objects.get(id=user_id) if user_id else None
            ticket = assign_ticket(ticket, technician, request.user)
            return Response(TicketDetailSerializer(ticket).data)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
