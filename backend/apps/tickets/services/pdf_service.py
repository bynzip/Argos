from decimal import Decimal

from django.db.models import Sum
from django.template.loader import render_to_string
from django.utils import timezone

from apps.core.models import CompanyProfile
from apps.finance.models import Receipt
from apps.tickets.models import Ticket


MONEY_QUANTIZE = Decimal('0.01')


def _format_money(value):
    amount = Decimal(str(value or '0')).quantize(MONEY_QUANTIZE)
    return f"S/. {amount:.2f}"


def _format_date_parts(value):
    if not value:
        return {'day': '', 'month': '', 'year': ''}

    if timezone.is_aware(value):
        value = timezone.localtime(value)

    return {
        'day': f'{value.day:02d}',
        'month': f'{value.month:02d}',
        'year': str(value.year),
    }


def _get_company_profile():
    profile = CompanyProfile.objects.order_by('-updated_at', '-id').first()
    if profile:
        return profile
    return CompanyProfile.objects.create(
        business_name='Argos ERP',
        ruc='12345678901',
        phone='064-123456',
        email='contacto@argos.com',
    )


def _build_absolute_url(request, url):
    if not url:
        return ''
    return request.build_absolute_uri(url)


def _get_confirmed_payment_total(ticket, active_quote):
    receipt_queryset = active_quote.receipts if active_quote else ticket.receipts
    return receipt_queryset.filter(
        estado=Receipt.ReceiptStatus.CONFIRMED,
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')


def _get_active_ticket_quote(ticket):
    try:
        from apps.quotes.services import get_active_ticket_quote
    except Exception:
        return None
    return get_active_ticket_quote(ticket)


def _build_accessories_text(ticket):
    accessory_rows = []
    for accessory in ticket.accessories.all():
        details = [accessory.nombre]
        if accessory.condicion:
            details.append(accessory.condicion)
        if accessory.notas:
            details.append(accessory.notas)
        accessory_rows.append(' - '.join(details))
    return ', '.join(accessory_rows)


def _write_pdf(html, base_url):
    from weasyprint import HTML

    return HTML(string=html, base_url=base_url).write_pdf()


def generate_guia_internamiento_pdf(ticket_id, request):
    ticket = (
        Ticket.objects.select_related('customer', 'device', 'created_by')
        .prefetch_related('accessories')
        .get(pk=ticket_id)
    )
    company_profile = _get_company_profile()
    active_quote = _get_active_ticket_quote(ticket)
    a_cuenta = _get_confirmed_payment_total(ticket, active_quote)
    costo_total = active_quote.total if active_quote else ticket.total

    logo_url = ''
    if company_profile.logo:
        logo_url = _build_absolute_url(request, company_profile.logo.url)

    context = {
        'ticket': ticket,
        'customer': ticket.customer,
        'device': ticket.device,
        'company': company_profile,
        'company_logo_url': logo_url,
        'fecha_ingreso': _format_date_parts(ticket.created_at),
        'fecha_salida_aprox': _format_date_parts(ticket.entrega_estimada),
        'accessories_text': _build_accessories_text(ticket),
        'costo_total': _format_money(costo_total),
        'a_cuenta': _format_money(a_cuenta),
        'saldo_pendiente': _format_money(ticket.saldo_pendiente),
        'base_url': request.build_absolute_uri('/'),
    }
    html = render_to_string('tickets/guia_internamiento.html', context)
    return _write_pdf(html, context['base_url'])
