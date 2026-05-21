from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.models import CompanyProfile
from apps.customers.models import Customer, Device
from apps.tickets.models import Ticket
from apps.tickets.views import TicketPagination
from apps.users.permissions import RolePermission
from apps.customers.services import get_or_create_generic_customer

from .pdf_utils import build_quote_pdf_lines, generate_simple_pdf
from .models import Quote
from .serializers import QuoteDetailSerializer, QuoteListSerializer
from .services import (
    approve_amount_approval,
    approve_quote,
    convert_quote_to_ticket,
    create_quote,
    create_quote_version,
    reject_amount_approval,
    reject_quote,
    send_quote,
    update_quote,
)


class QuoteViewSet(viewsets.ModelViewSet):
    queryset = Quote.objects.select_related('customer', 'device', 'source_ticket', 'created_by').prefetch_related(
        'lines', 'approvals', 'attachments'
    ).order_by('-created_at')
    permission_classes = [IsAuthenticated, RolePermission]
    pagination_class = TicketPagination
    required_permissions = {
        'list': ['quotes.view_list', 'quotes.view_draft'],
        'retrieve': ['quotes.view_detail', 'quotes.view_draft'],
        'create': ['quotes.create'],
        'update': ['quotes.create'],
        'partial_update': ['quotes.create'],
        'send': ['quotes.send'],
        'approve': ['quotes.approve'],
        'reject': ['quotes.reject'],
        'new_version': ['quotes.create'],
        'convert_to_ticket': ['quotes.convert_to_ticket'],
        'approve_amount': ['quotes.approve_multinivel'],
        'reject_amount': ['quotes.approve_multinivel'],
        'download_pdf': ['quotes.view_detail', 'quotes.view_draft'],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['estado', 'customer', 'source_ticket', 'is_active_version', 'quote_type']
    search_fields = ['folio', 'customer__nombre', 'customer__identificador']
    ordering_fields = ['created_at', 'valido_hasta', 'total', 'version']

    def get_queryset(self):
        queryset = super().get_queryset()
        source_ticket = self.request.query_params.get('source_ticket')
        if source_ticket:
            queryset = queryset.filter(source_ticket_id=source_ticket)
        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return QuoteListSerializer
        return QuoteDetailSerializer

    def create(self, request, *args, **kwargs):
        customer_id = request.data.get('customer')
        device_id = request.data.get('device')
        source_ticket_id = request.data.get('source_ticket')
        quote_type = request.data.get('quote_type') or Quote.QuoteType.REPAIR
        lines = request.data.get('lines')

        customer = None
        if customer_id:
            try:
                customer = Customer.objects.get(id=customer_id)
            except Customer.DoesNotExist:
                return Response({'detail': 'Cliente no encontrado'}, status=status.HTTP_400_BAD_REQUEST)
        elif quote_type == Quote.QuoteType.DIRECT:
            customer = get_or_create_generic_customer()

        device = None
        if device_id:
            try:
                device = Device.objects.get(id=device_id)
            except Device.DoesNotExist:
                return Response({'detail': 'Dispositivo no encontrado'}, status=status.HTTP_400_BAD_REQUEST)

        source_ticket = None
        if source_ticket_id:
            try:
                source_ticket = Ticket.objects.get(id=source_ticket_id)
            except Ticket.DoesNotExist:
                return Response({'detail': 'Ticket no encontrado'}, status=status.HTTP_400_BAD_REQUEST)

        quote = create_quote(
            user=request.user,
            customer=customer,
            device=device,
            source_ticket=source_ticket,
            quote_type=quote_type,
            lines=lines,
            descuento=request.data.get('descuento', 0),
            igv_rate=request.data.get('igv_rate'),
            valido_hasta=request.data.get('valido_hasta'),
            notas=request.data.get('notas', ''),
            attachments=request.FILES.getlist('attachments'),
        )
        return Response(QuoteDetailSerializer(quote).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        customer = None
        customer_id = request.data.get('customer')
        if customer_id:
            try:
                customer = Customer.objects.get(id=customer_id)
            except Customer.DoesNotExist:
                return Response({'detail': 'Cliente no encontrado'}, status=status.HTTP_400_BAD_REQUEST)

        device = None
        device_id = request.data.get('device')
        if device_id:
            try:
                device = Device.objects.get(id=device_id)
            except Device.DoesNotExist:
                return Response({'detail': 'Dispositivo no encontrado'}, status=status.HTTP_400_BAD_REQUEST)

        source_ticket = None
        source_ticket_id = request.data.get('source_ticket')
        if source_ticket_id:
            try:
                source_ticket = Ticket.objects.get(id=source_ticket_id)
            except Ticket.DoesNotExist:
                return Response({'detail': 'Ticket no encontrado'}, status=status.HTTP_400_BAD_REQUEST)

        quote = update_quote(
            quote=self.get_object(),
            user=request.user,
            customer=customer,
            device=device,
            source_ticket=source_ticket,
            quote_type=request.data.get('quote_type'),
            lines=request.data.get('lines'),
            descuento=request.data.get('descuento'),
            igv_rate=request.data.get('igv_rate'),
            valido_hasta=request.data.get('valido_hasta'),
            notas=request.data.get('notas'),
            attachments=request.FILES.getlist('attachments'),
        )
        return Response(QuoteDetailSerializer(quote).data)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        quote = send_quote(quote=self.get_object(), user=request.user)
        return Response(QuoteDetailSerializer(quote).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        quote = approve_quote(quote=self.get_object(), user=request.user)
        return Response(QuoteDetailSerializer(quote).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        quote = reject_quote(quote=self.get_object(), user=request.user, motivo=request.data.get('motivo', ''))
        return Response(QuoteDetailSerializer(quote).data)

    @action(detail=True, methods=['post'])
    def new_version(self, request, pk=None):
        quote = create_quote_version(quote=self.get_object(), user=request.user)
        return Response(QuoteDetailSerializer(quote).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def convert_to_ticket(self, request, pk=None):
        ticket = convert_quote_to_ticket(quote=self.get_object(), user=request.user)
        return Response({'ticket_id': ticket.id, 'ticket_folio': ticket.folio}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def approve_amount(self, request, pk=None):
        approval = approve_amount_approval(quote=self.get_object(), user=request.user, notas=request.data.get('notas', ''))
        return Response({'approval_id': approval.id, 'estado': approval.estado})

    @action(detail=True, methods=['post'])
    def reject_amount(self, request, pk=None):
        approval = reject_amount_approval(quote=self.get_object(), user=request.user, notas=request.data.get('notas', ''))
        return Response({'approval_id': approval.id, 'estado': approval.estado})

    @action(detail=True, methods=['get'], url_path='download-pdf')
    def download_pdf(self, request, pk=None):
        quote = self.get_object()
        company_profile = CompanyProfile.objects.first()
        pdf_bytes = generate_simple_pdf(build_quote_pdf_lines(quote, company_profile))
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{quote.folio}-v{quote.version}.pdf"'
        return response


class TicketQuoteViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['quotes.view_list', 'quotes.view_draft'],
        'create': ['quotes.create'],
    }

    def list(self, request, ticket_pk=None):
        try:
            ticket = Ticket.objects.get(pk=ticket_pk)
        except Ticket.DoesNotExist:
            return Response({'detail': 'Ticket no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        quotes = ticket.quotes.select_related('customer', 'device', 'source_ticket', 'created_by').prefetch_related('approvals')
        return Response(QuoteListSerializer(quotes.order_by('-version'), many=True).data)

    def create(self, request, ticket_pk=None):
        try:
            ticket = Ticket.objects.get(pk=ticket_pk)
        except Ticket.DoesNotExist:
            return Response({'detail': 'Ticket no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        quote = create_quote(
            user=request.user,
            customer=ticket.customer,
            device=ticket.device,
            source_ticket=ticket,
            quote_type=request.data.get('quote_type') or Quote.QuoteType.REPAIR,
            lines=request.data.get('lines'),
            descuento=request.data.get('descuento', 0),
            igv_rate=request.data.get('igv_rate'),
            valido_hasta=request.data.get('valido_hasta'),
            notas=request.data.get('notas', ''),
            attachments=request.FILES.getlist('attachments'),
        )
        return Response(QuoteDetailSerializer(quote).data, status=status.HTTP_201_CREATED)
