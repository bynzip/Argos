from decimal import Decimal

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.finance.models import CocheraCharge, Discount, PaymentReversal, PaymentSchedule, Receipt
from apps.tickets.models import Ticket
from apps.users.permissions import RolePermission

from .serializers import (
    CashClosureSerializer,
    CocheraChargeSerializer,
    DiscountSerializer,
    PaymentReversalSerializer,
    PaymentScheduleSerializer,
    ReceiptSerializer,
)
from .services import (
    close_cash_closure,
    confirm_payment,
    create_payment_schedule,
    decide_discount,
    decide_reversal,
    generate_storage_charges,
    get_open_cash_closure,
    open_cash_closure,
    reprogram_schedule,
    register_payment,
    request_discount,
    request_reversal,
)


class CashClosureViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['finance.view_cash'],
        'open': ['finance.open_close_cash'],
        'close': ['finance.open_close_cash'],
    }

    def list(self, request):
        closure = get_open_cash_closure(request.user)
        if not closure:
            return Response({'detail': 'No hay caja abierta'}, status=status.HTTP_404_NOT_FOUND)

        serializer = CashClosureSerializer(closure)
        from django.db.models import Sum

        confirmed_receipts = closure.receipts.filter(estado='CONFIRMED')
        pending_receipts = closure.receipts.filter(estado='PENDING')

        data = serializer.data
        data['ingresos_por_metodo'] = list(
            confirmed_receipts.values('metodo_pago').annotate(total=Sum('amount'))
        )
        data['pendientes_por_metodo'] = list(
            pending_receipts.values('metodo_pago').annotate(total=Sum('amount'))
        )
        data['total_dia'] = confirmed_receipts.aggregate(t=Sum('amount'))['t'] or 0
        data['pending_total'] = pending_receipts.aggregate(t=Sum('amount'))['t'] or 0
        return Response(data)

    @action(detail=False, methods=['post'])
    def open(self, request):
        opening_amount = request.data.get('opening_amount', 0)
        closure = open_cash_closure(request.user, opening_amount)
        return Response(CashClosureSerializer(closure).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def close(self, request):
        declared_amount = request.data.get('declared_amount', 0)
        notes = request.data.get('notes', '')
        closure = close_cash_closure(request.user, declared_amount, notes)
        return Response(CashClosureSerializer(closure).data)


class PaymentViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['finance.view_receipts'],
        'create': ['finance.register_payment'],
        'confirm': ['finance.confirm_payment'],
    }

    def list(self, request, ticket_id=None):
        receipts = Receipt.objects.filter(ticket_id=ticket_id).order_by('-created_at')
        return Response(ReceiptSerializer(receipts, many=True).data)

    def create(self, request, ticket_id=None):
        try:
            ticket = Ticket.objects.get(id=ticket_id)
        except Ticket.DoesNotExist:
            return Response({'detail': 'Ticket no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        amount = request.data.get('amount')
        metodo_pago = request.data.get('metodo_pago')
        referencia = request.data.get('referencia')
        voucher_file = request.FILES.get('voucher_file')
        tipo_recibo = request.data.get('tipo_recibo')
        schedule_items = request.data.get('schedule_items')

        if not amount or not metodo_pago:
            return Response({'detail': 'amount y metodo_pago son obligatorios'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount_decimal = Decimal(str(amount))
        except ValueError:
            return Response({'detail': 'Monto inválido'}, status=status.HTTP_400_BAD_REQUEST)

        receipt = register_payment(
            user=request.user,
            ticket=ticket,
            amount=amount_decimal,
            metodo_pago=metodo_pago,
            referencia=referencia,
            voucher_file=voucher_file,
            tipo_recibo=tipo_recibo,
            schedule_items=schedule_items,
        )
        return Response(ReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None, ticket_id=None):
        try:
            receipt = Receipt.objects.get(pk=pk)
        except Receipt.DoesNotExist:
            return Response({'detail': 'Recibo no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        receipt = confirm_payment(request.user, receipt, schedule_items=request.data.get('schedule_items'))
        return Response(ReceiptSerializer(receipt).data)


class PaymentScheduleViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['finance.view_receipts', 'finance.manage_schedules'],
        'create': ['finance.manage_schedules'],
        'reprogram': ['finance.manage_schedules'],
    }

    def list(self, request, ticket_id=None):
        schedules = PaymentSchedule.objects.filter(ticket_id=ticket_id).order_by('numero_cuota')
        return Response(PaymentScheduleSerializer(schedules, many=True).data)

    def create(self, request, ticket_id=None):
        try:
            ticket = Ticket.objects.get(pk=ticket_id)
        except Ticket.DoesNotExist:
            return Response({'detail': 'Ticket no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        installments = request.data.get('installments') or []
        schedules = create_payment_schedule(ticket=ticket, user=request.user, installments=installments)
        return Response(PaymentScheduleSerializer(schedules, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def reprogram(self, request, pk=None, ticket_id=None):
        try:
            schedule = PaymentSchedule.objects.get(pk=pk, ticket_id=ticket_id)
        except PaymentSchedule.DoesNotExist:
            return Response({'detail': 'Cuota no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        schedule = reprogram_schedule(
            schedule=schedule,
            user=request.user,
            new_date=request.data.get('new_date'),
            motivo=request.data.get('motivo', ''),
        )
        return Response(PaymentScheduleSerializer(schedule).data)


class DiscountViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['finance.request_discount', 'finance.approve_discount'],
        'create': ['finance.request_discount'],
        'approve': ['finance.approve_discount'],
        'reject': ['finance.approve_discount'],
    }

    def list(self, request):
        queryset = Discount.objects.all().order_by('-created_at')
        ticket_id = request.query_params.get('ticket_id')
        if ticket_id:
            queryset = queryset.filter(ticket_id=ticket_id)
        return Response(DiscountSerializer(queryset, many=True).data)

    def create(self, request):
        ticket_id = request.data.get('ticket_id')
        try:
            ticket = Ticket.objects.get(pk=ticket_id)
        except Ticket.DoesNotExist:
            return Response({'detail': 'Ticket no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        discount = request_discount(
            ticket=ticket,
            user=request.user,
            tipo_descuento=request.data.get('tipo_descuento'),
            respuesta=request.data.get('respuesta'),
            motivo=request.data.get('motivo', ''),
        )
        return Response(DiscountSerializer(discount).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        discount = Discount.objects.get(pk=pk)
        discount = decide_discount(discount=discount, user=request.user, approve=True, notas_admin=request.data.get('notas_admin', ''))
        return Response(DiscountSerializer(discount).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        discount = Discount.objects.get(pk=pk)
        discount = decide_discount(discount=discount, user=request.user, approve=False, notas_admin=request.data.get('notas_admin', ''))
        return Response(DiscountSerializer(discount).data)


class PaymentReversalViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['finance.request_reversal', 'finance.approve_reversal'],
        'create': ['finance.request_reversal'],
        'approve': ['finance.approve_reversal'],
        'reject': ['finance.approve_reversal'],
    }

    def list(self, request):
        queryset = PaymentReversal.objects.select_related('receipt').all().order_by('-created_at')
        receipt_id = request.query_params.get('receipt_id')
        if receipt_id:
            queryset = queryset.filter(receipt_id=receipt_id)
        return Response(PaymentReversalSerializer(queryset, many=True).data)

    def create(self, request):
        receipt_id = request.data.get('receipt_id')
        try:
            receipt = Receipt.objects.get(pk=receipt_id)
        except Receipt.DoesNotExist:
            return Response({'detail': 'Recibo no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        reversal = request_reversal(
            receipt=receipt,
            user=request.user,
            tipo_reversa=request.data.get('tipo_reversa'),
            motivo=request.data.get('motivo', ''),
        )
        return Response(PaymentReversalSerializer(reversal).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        reversal = PaymentReversal.objects.get(pk=pk)
        reversal = decide_reversal(reversal=reversal, user=request.user, approve=True)
        return Response(PaymentReversalSerializer(reversal).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        reversal = PaymentReversal.objects.get(pk=pk)
        reversal = decide_reversal(reversal=reversal, user=request.user, approve=False)
        return Response(PaymentReversalSerializer(reversal).data)


class CocheraChargeViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['finance.view_receipts'],
        'generate': ['finance.manage_schedules'],
    }

    def list(self, request, ticket_id=None):
        charges = CocheraCharge.objects.filter(ticket_id=ticket_id).order_by('-charge_date')
        return Response(CocheraChargeSerializer(charges, many=True).data)

    @action(detail=False, methods=['post'])
    def generate(self, request, ticket_id=None):
        try:
            ticket = Ticket.objects.get(pk=ticket_id)
        except Ticket.DoesNotExist:
            return Response({'detail': 'Ticket no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        charges = generate_storage_charges(ticket=ticket)
        return Response(CocheraChargeSerializer(charges, many=True).data, status=status.HTTP_201_CREATED)
