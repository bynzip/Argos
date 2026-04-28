from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import RolePermission
from django.core.exceptions import ValidationError
from decimal import Decimal

from .models import CashClosure, Receipt
from .serializers import CashClosureSerializer, ReceiptSerializer
from .services import open_cash_closure, close_cash_closure, register_payment, get_open_cash_closure
from apps.tickets.models import Ticket

class CashClosureViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, RolePermission]
    required_permissions = {
        'list': ['finance.view_cash'],
        'open': ['finance.open_close_cash'],
        'close': ['finance.open_close_cash'],
    }

    def list(self, request):
        closure = get_open_cash_closure(request.user)
        if closure:
            serializer = CashClosureSerializer(closure)
            
            # Additional summary
            from django.db.models import Sum
            ingresos_por_metodo = closure.receipts.filter(estado__in=['CONFIRMED', 'PENDING']).values('metodo_pago').annotate(total=Sum('amount'))
            
            data = serializer.data
            data['ingresos_por_metodo'] = ingresos_por_metodo
            data['total_dia'] = closure.receipts.filter(estado__in=['CONFIRMED', 'PENDING']).aggregate(t=Sum('amount'))['t'] or 0
            
            return Response(data)
        return Response({'detail': 'No hay caja abierta'}, status=status.HTTP_404_NOT_FOUND)

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
    }

    def list(self, request, ticket_id=None):
        receipts = Receipt.objects.filter(ticket_id=ticket_id).order_by('-created_at')
        serializer = ReceiptSerializer(receipts, many=True)
        return Response(serializer.data)

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
