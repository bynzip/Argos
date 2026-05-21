from decimal import Decimal
from io import BytesIO
from textwrap import wrap


PAGE_WIDTH = 595
PAGE_HEIGHT = 842
PAGE_MARGIN_X = 50
PAGE_MARGIN_TOP = 54
PAGE_MARGIN_BOTTOM = 54
LINE_HEIGHT = 15


def _escape_pdf_text(value):
    text = str(value or '')
    return text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def _format_money(value):
    amount = Decimal(str(value or '0')).quantize(Decimal('0.01'))
    return f"S/ {amount:.2f}"


def _append_wrapped(lines, text, width=78):
    content = str(text or '').strip()
    if not content:
        return
    for chunk in wrap(content, width=width):
        lines.append(chunk)


def build_quote_pdf_lines(quote, company_profile):
    customer = quote.customer
    device = quote.device
    ticket = quote.source_ticket
    lines = []

    lines.append(company_profile.business_name if company_profile else 'Argos')
    if company_profile:
        lines.append(f"RUC: {company_profile.ruc} | Tel: {company_profile.phone} | Email: {company_profile.email}")
    lines.append('')
    lines.append(
        f"COTIZACION {quote.folio}  |  Tipo {quote.get_quote_type_display()}  |  Version {quote.version}  |  Estado {quote.get_estado_display()}"
    )
    lines.append(f"Fecha: {quote.created_at:%d/%m/%Y %H:%M}")
    if quote.valido_hasta:
        lines.append(f"Vigencia: {quote.valido_hasta:%d/%m/%Y}")
    lines.append('')
    lines.append('CLIENTE')
    lines.append(f"Nombre: {customer.nombre}")
    lines.append(f"Documento: {customer.identificador}")
    if device:
        device_parts = [part for part in [device.marca, device.modelo, getattr(device, 'numero_serie', '')] if part]
        lines.append(f"Equipo: {' | '.join(device_parts)}")
    if ticket:
        lines.append(f"Ticket asociado: {ticket.folio}")
    lines.append('')
    lines.append('DETALLE')
    lines.append('Item | Tipo | Descripcion | Cant. | P.Unit | Desc. | Total')

    for index, line in enumerate(quote.lines.all(), start=1):
        if line.descripcion:
            descripcion = line.descripcion
        elif line.product:
            descripcion = line.product.nombre
        elif line.service:
            descripcion = line.service.nombre
        else:
            descripcion = ''
        header = (
            f"{index}. {line.get_line_type_display()} | "
            f"{descripcion[:40]} | "
            f"{line.cantidad} | {_format_money(line.precio_unitario)} | "
            f"{_format_money(line.descuento_linea)} | {_format_money(line.total_linea)}"
        )
        _append_wrapped(lines, header, width=82)
        if len(descripcion) > 40:
            _append_wrapped(lines, f"    {descripcion[40:]}", width=78)

    lines.append('')
    lines.append(f"Subtotal: {_format_money(quote.subtotal)}")
    lines.append(f"Descuento: {_format_money(quote.descuento)}")
    lines.append(f"IGV ({quote.igv_rate}%): {_format_money(quote.igv_amount)}")
    lines.append(f"TOTAL: {_format_money(quote.total)}")
    lines.append('')

    if quote.notas:
        lines.append('OBSERVACIONES')
        _append_wrapped(lines, quote.notas, width=82)
        lines.append('')

    lines.append(f"Documento generado desde Argos para descarga interna. Estado actual: {quote.get_estado_display()}.")
    return lines


def _build_page_stream(lines):
    y = PAGE_HEIGHT - PAGE_MARGIN_TOP
    chunks = ['BT', '/F1 10 Tf']
    for line in lines:
        safe_line = _escape_pdf_text(line)
        chunks.append(f'1 0 0 1 {PAGE_MARGIN_X} {y} Tm ({safe_line}) Tj')
        y -= LINE_HEIGHT
    chunks.append('ET')
    return '\n'.join(chunks).encode('latin-1', errors='replace')


def generate_simple_pdf(text_lines):
    lines_per_page = max(1, int((PAGE_HEIGHT - PAGE_MARGIN_TOP - PAGE_MARGIN_BOTTOM) / LINE_HEIGHT))
    pages = [text_lines[index:index + lines_per_page] for index in range(0, len(text_lines), lines_per_page)] or [[]]

    objects = []
    objects.append(b'<< /Type /Catalog /Pages 2 0 R >>')

    page_count = len(pages)
    kids = ' '.join(f'{3 + (index * 2)} 0 R' for index in range(page_count))
    objects.append(f'<< /Type /Pages /Count {page_count} /Kids [{kids}] >>'.encode('latin-1'))

    font_object_id = 3 + (page_count * 2)
    for index, page_lines in enumerate(pages):
        page_object_id = 3 + (index * 2)
        content_object_id = page_object_id + 1
        page_object = (
            f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] '
            f'/Resources << /Font << /F1 {font_object_id} 0 R >> >> /Contents {content_object_id} 0 R >>'
        )
        objects.append(page_object.encode('latin-1'))

        stream = _build_page_stream(page_lines)
        content_object = b'<< /Length ' + str(len(stream)).encode('latin-1') + b' >>\nstream\n' + stream + b'\nendstream'
        objects.append(content_object)

    objects.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

    buffer = BytesIO()
    buffer.write(b'%PDF-1.4\n')
    offsets = [0]
    for object_id, object_bytes in enumerate(objects, start=1):
        offsets.append(buffer.tell())
        buffer.write(f'{object_id} 0 obj\n'.encode('latin-1'))
        buffer.write(object_bytes)
        buffer.write(b'\nendobj\n')

    xref_start = buffer.tell()
    buffer.write(f'xref\n0 {len(objects) + 1}\n'.encode('latin-1'))
    buffer.write(b'0000000000 65535 f \n')
    for offset in offsets[1:]:
        buffer.write(f'{offset:010d} 00000 n \n'.encode('latin-1'))

    trailer = (
        f'trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n'
        f'startxref\n{xref_start}\n%%EOF'
    )
    buffer.write(trailer.encode('latin-1'))
    return buffer.getvalue()
