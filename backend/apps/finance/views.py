from decimal import Decimal

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.tickets.models import Ticket
from apps.users.permissions import RolePermission

from .models import Receipt
from .serializers import CashClosureSerializer, ReceiptSerializer
from .services import (
    close_cash_closure,
    confirm_payment,
    get_open_cash_closure,
    open_cash_closure,
    register_payment,
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
            voucher_file=voucher_file
        )
        return Response(ReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None, ticket_id=None):
        try:
            receipt = Receipt.objects.get(pk=pk)
        except Receipt.DoesNotExist:
            return Response({'detail': 'Recibo no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        receipt = confirm_payment(request.user, receipt)
        return Response(ReceiptSerializer(receipt).data)
