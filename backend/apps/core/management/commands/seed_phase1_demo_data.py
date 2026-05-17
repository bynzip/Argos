from datetime import datetime, time, timedelta
from decimal import Decimal

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.core.models import CompanyProfile
from apps.core.utils import generate_folio
from apps.customers.models import Customer, Device
from apps.finance.models import CashClosure, Discount, PaymentReversal, Receipt
from apps.finance.services import (
    create_payment_schedule,
    decide_discount,
    decide_reversal,
    generate_storage_charges,
    request_discount,
    request_reversal,
)
from apps.hr.models import Attendance, AttendanceBreak, AttendanceCorrection, Observation, WorkSchedule, WorkScheduleItem
from apps.products.models import Brand, Category, InventoryMovement, Product, ProductSupplier, StockItem, Warehouse
from apps.products.services.inventory_service import record_inventory_movement, reserve_stock
from apps.quotes.models import Quote, QuoteApproval, QuoteLine
from apps.services.models import Service, ServiceCategory, TicketService
from apps.suppliers.models import Supplier
from apps.suppliers.services import create_supplier_order, receive_purchase_order, send_purchase_order
from apps.tickets.models import Ticket, TicketChecklistItem, TicketSubareaMovement, TicketTransition
from apps.tickets.services.ticket_service import create_ticket, create_warranty_ticket
from apps.users.models import Role, Subarea, User, UserRole


class Command(BaseCommand):
    help = 'Carga datos demo coherentes para probar toda la Fase 1 de Argos ERP.'

    def handle(self, *args, **kwargs):
        if Customer.objects.exists() or Product.objects.exists() or Ticket.objects.exists():
            raise CommandError(
                'La base ya contiene datos operativos. Usa una base nueva o limpia antes de ejecutar este seeder.'
            )

        call_command('setup_initial_data')

        with transaction.atomic():
            self.now = timezone.now()
            self.company = self.seed_company_profile()
            self.users = self.seed_users()
            self.warehouses, self.products = self.seed_inventory()
            self.services = self.seed_services()
            self.suppliers, self.purchase_orders = self.seed_suppliers_and_purchases()
            self.customers, self.devices = self.seed_customers()
            self.tickets = self.seed_tickets()
            self.quotes = self.seed_quotes()
            self.seed_finance()
            self.seed_hr()

        self.stdout.write(self.style.SUCCESS('Datos demo de Fase 1 cargados correctamente.'))
        self.stdout.write(self.style.SUCCESS('Credenciales demo: admin / argos2025admin, recep_demo / Argos1234, tech_demo_1 / Argos1234'))

    def find_role(self, *candidates):
        for candidate in candidates:
            role = Role.objects.filter(nombre__iexact=candidate).first() or Role.objects.filter(nombre__icontains=candidate).first()
            if role:
                return role
        raise CommandError(f'No se encontro ninguno de estos roles: {", ".join(candidates)}.')

    def find_subarea(self, *candidates):
        for candidate in candidates:
            subarea = Subarea.objects.filter(nombre__iexact=candidate).first() or Subarea.objects.filter(nombre__icontains=candidate).first()
            if subarea:
                return subarea
        raise CommandError(f'No se encontro ninguna de estas subareas: {", ".join(candidates)}.')

    def seed_company_profile(self):
        profile, _ = CompanyProfile.objects.get_or_create(
            business_name='Argos Service Center',
            defaults={
                'legal_name': 'Argos Service Center SAC',
                'ruc': '20601234567',
                'phone': '064-555555',
                'email': 'operaciones@argos.local',
                'address': 'Jr. Los Talleres 145, Huancayo',
                'cochera_grace_days': 2,
                'cochera_daily_rate': Decimal('12.50'),
                'credit_grace_days': 3,
                'credit_morosidad_limit': Decimal('150.00'),
            },
        )
        return profile

    def seed_users(self):
        recepcion = self.find_subarea('Recepción', 'Recepcion')
        diagnostico = self.find_subarea('Diagnóstico', 'Diagnostico')
        reparacion = self.find_subarea('Reparación', 'Reparacion')
        almacen = self.find_subarea('Almacén Principal', 'Almacen Principal')
        ensamblaje = self.find_subarea('Ensamblaje')

        users = {'admin': User.objects.get(username='admin')}
        role_assignments = [
            ('admin_operaciones', 'admin.operaciones@argos.local', 'Ana Torres', self.find_role('Administrador'), None),
            ('recep_demo', 'recepcion@argos.local', 'Lucia Paredes', self.find_role('Recepcionista'), recepcion),
            ('tech_demo_1', 'tech1@argos.local', 'Marco Salazar', self.find_role('Técnico', 'Tecnico'), diagnostico),
            ('tech_demo_2', 'tech2@argos.local', 'Diego Ramos', self.find_role('Técnico', 'Tecnico'), reparacion),
            ('almacen_demo', 'almacen@argos.local', 'Rosa Meza', self.find_role('Almacenero'), almacen),
            ('supervisor_demo', 'supervisor@argos.local', 'Carlos Huaman', self.find_role('Técnico', 'Tecnico'), ensamblaje),
        ]

        for username, email, nombre, role, subarea in role_assignments:
            user = User.objects.create_user(
                username=username,
                email=email,
                password='Argos1234',
                nombre=nombre,
                subarea=subarea,
            )
            UserRole.objects.get_or_create(user=user, role=role)
            users[username] = user
        return users

    def seed_inventory(self):
        warehouses = [
            Warehouse.objects.create(nombre='Almacen Principal', ubicacion='Sede Central'),
            Warehouse.objects.create(nombre='Taller Tecnico', ubicacion='Zona de reparacion'),
            Warehouse.objects.create(nombre='Cochera Temporal', ubicacion='Area de espera'),
        ]

        categories = [
            Category.objects.create(nombre='Pantallas'),
            Category.objects.create(nombre='Baterias'),
            Category.objects.create(nombre='Memorias'),
            Category.objects.create(nombre='Almacenamiento'),
            Category.objects.create(nombre='Perifericos'),
        ]
        brands = [
            Brand.objects.create(nombre='HP'),
            Brand.objects.create(nombre='Lenovo'),
            Brand.objects.create(nombre='Kingston'),
            Brand.objects.create(nombre='WD'),
            Brand.objects.create(nombre='Logitech'),
            Brand.objects.create(nombre='Dell'),
        ]

        product_specs = [
            ('PANT-156-HP', 'Pantalla 15.6 HP LED', 150, 240, 3, categories[0], brands[0], 6),
            ('PANT-140-LEN', 'Pantalla 14 Lenovo Slim', 135, 220, 2, categories[0], brands[1], 4),
            ('BAT-HP-01', 'Bateria HP Pavilion 3 celdas', 95, 160, 2, categories[1], brands[0], 5),
            ('BAT-DEL-01', 'Bateria Dell Inspiron 4 celdas', 110, 175, 2, categories[1], brands[5], 2),
            ('RAM-8-DDR4', 'Memoria RAM 8GB DDR4', 68, 118, 4, categories[2], brands[2], 9),
            ('RAM-16-DDR4', 'Memoria RAM 16GB DDR4', 122, 198, 3, categories[2], brands[2], 5),
            ('SSD-500-WD', 'SSD NVMe 500GB', 115, 185, 3, categories[3], brands[3], 7),
            ('SSD-1TB-WD', 'SSD NVMe 1TB', 195, 285, 2, categories[3], brands[3], 3),
            ('MOUSE-LOGI', 'Mouse Logitech Inalambrico', 35, 65, 5, categories[4], brands[4], 10),
            ('TECL-LOGI', 'Teclado Logitech Compacto', 45, 80, 5, categories[4], brands[4], 8),
        ]

        products = []
        for code, name, cost, sale, minimum, category, brand, stock in product_specs:
            product = Product.objects.create(
                codigo=code,
                nombre=name,
                descripcion=f'{name} para servicio tecnico y reposicion.',
                precio_costo=Decimal(str(cost)),
                precio_venta=Decimal(str(sale)),
                stock_minimo=minimum,
                category=category,
                brand=brand,
            )
            products.append(product)
            for warehouse in warehouses[:2]:
                quantity = Decimal(str(stock if warehouse == warehouses[0] else max(stock - 2, 1)))
                StockItem.objects.create(
                    product=product,
                    warehouse=warehouse,
                    cantidad=quantity,
                    reservado=Decimal('0.000'),
                    costo_promedio=Decimal(str(cost)),
                )
                record_inventory_movement(
                    product=product,
                    warehouse=warehouse,
                    movement_type=InventoryMovement.MovementType.ADJUSTMENT_IN,
                    quantity=quantity,
                    user=self.users['admin'],
                    unit_cost=product.precio_costo,
                    reference_type='Seeder',
                    reference_id=product.id,
                    notes='Carga inicial demo Fase 1',
                )

        return warehouses, products

    def seed_services(self):
        categories = [
            ServiceCategory.objects.create(nombre='Diagnostico'),
            ServiceCategory.objects.create(nombre='Mantenimiento'),
            ServiceCategory.objects.create(nombre='Cambio de componente'),
            ServiceCategory.objects.create(nombre='Software'),
            ServiceCategory.objects.create(nombre='Recuperacion'),
        ]
        service_specs = [
            ('SRV-DIAG-01', 'Diagnostico general de laptop', 45, 1.5, categories[0]),
            ('SRV-DIAG-02', 'Diagnostico de desktop', 40, 1.0, categories[0]),
            ('SRV-MANT-01', 'Mantenimiento preventivo', 80, 2.0, categories[1]),
            ('SRV-MANT-02', 'Limpieza profunda con cambio de pasta', 120, 2.5, categories[1]),
            ('SRV-COMP-01', 'Cambio de pantalla', 90, 2.0, categories[2]),
            ('SRV-COMP-02', 'Cambio de bateria', 70, 1.0, categories[2]),
            ('SRV-SOFT-01', 'Instalacion de sistema operativo', 85, 2.0, categories[3]),
            ('SRV-SOFT-02', 'Migracion y respaldo de datos', 95, 2.5, categories[3]),
            ('SRV-REC-01', 'Recuperacion basica de archivos', 140, 3.0, categories[4]),
            ('SRV-REC-02', 'Optimizacion y puesta a punto', 65, 1.5, categories[1]),
        ]

        services = []
        for code, name, price, hours, category in service_specs:
            services.append(
                Service.objects.create(
                    codigo=code,
                    category=category,
                    nombre=name,
                    descripcion=f'{name} para flujo demo.',
                    precio_base=Decimal(str(price)),
                    horas_estimadas=Decimal(str(hours)),
                )
            )
        return services

    def seed_suppliers_and_purchases(self):
        supplier_specs = [
            ('Distribuidora Andes', '20600000001', 'Mario Rojas'),
            ('Tech Parts Centro', '20600000002', 'Elena Chavez'),
            ('Insumos Digitales SAC', '20600000003', 'Jorge Pena'),
            ('Repuestos Express', '20600000004', 'Patricia Leon'),
            ('Storage Peru', '20600000005', 'Miguel Silva'),
            ('CompuMarket Mayorista', '20600000006', 'Laura Quispe'),
        ]
        suppliers = []
        for index, (name, ruc, contact) in enumerate(supplier_specs, start=1):
            suppliers.append(
                Supplier.objects.create(
                    nombre=name,
                    ruc=ruc,
                    contacto=contact,
                    telefono=f'9640000{index}',
                    correo=f'contacto{index}@proveedor.local',
                    direccion=f'Av. Proveedor {100 + index}',
                )
            )

        for index, product in enumerate(self.products):
            ProductSupplier.objects.create(
                product=product,
                supplier=suppliers[index % len(suppliers)],
                supplier_price=product.precio_costo,
                lead_time_days=2 + (index % 4),
                is_primary=index < len(suppliers),
            )

        purchase_orders = []
        for index in range(5):
            po = create_supplier_order(
                user=self.users['almacen_demo'],
                supplier=suppliers[index],
                destination_warehouse=self.warehouses[0],
                items=[
                    {
                        'product': self.products[index].id,
                        'cantidad_pedida': '4.000',
                        'precio_unitario': str(self.products[index].precio_costo),
                    },
                    {
                        'product': self.products[index + 1].id,
                        'cantidad_pedida': '3.000',
                        'precio_unitario': str(self.products[index + 1].precio_costo),
                    },
                ],
                notes='Orden demo para pruebas de abastecimiento',
            )
            send_purchase_order(purchase_order=po, user=self.users['almacen_demo'], notes='Envio inicial demo')
            if index < 3:
                receive_purchase_order(
                    purchase_order=po,
                    user=self.users['almacen_demo'],
                    items=[
                        {'id': po.items.all()[0].id, 'cantidad_recibida': '2.000'},
                        {'id': po.items.all()[1].id, 'cantidad_recibida': '3.000' if index < 2 else '1.000'},
                    ],
                    notes='Recepcion demo',
                )
            purchase_orders.append(po)
        return suppliers, purchase_orders

    def seed_customers(self):
        customer_specs = [
            ('PERSONA', '74215638', 'Juan Perez', '985111001'),
            ('PERSONA', '70345612', 'Maria Gutierrez', '985111002'),
            ('EMPRESA', '20607845123', 'Constructora Huanca SAC', '985111003'),
            ('PERSONA', '71456789', 'Luis Romero', '985111004'),
            ('PERSONA', '72890012', 'Karla Medina', '985111005'),
            ('EMPRESA', '20607845124', 'Comercial Mantaro EIRL', '985111006'),
            ('PERSONA', '73456780', 'Fiorella Campos', '985111007'),
            ('PERSONA', '74567801', 'Pedro Chavez', '985111008'),
        ]
        device_types = ['Laptop', 'Laptop', 'PC', 'Impresora', 'Laptop', 'PC', 'Laptop', 'All in One']
        brands = ['HP', 'Lenovo', 'Dell', 'Epson', 'Asus', 'HP', 'Apple', 'Lenovo']

        customers = []
        devices = []
        for index, (tipo, identifier, name, phone) in enumerate(customer_specs):
            customer = Customer.objects.create(
                tipo_cliente=tipo,
                identificador=identifier,
                nombre=name,
                telefono=phone,
                correo_electronico=f'cliente{index + 1}@mail.local',
                direccion=f'Jr. Cliente {200 + index}',
                etiqueta='REGULAR' if index % 3 else 'VIP',
            )
            customers.append(customer)
            devices.append(
                Device.objects.create(
                    customer=customer,
                    tipo_equipo=device_types[index],
                    marca=brands[index],
                    modelo=f'{brands[index]} Modelo {index + 1}',
                    numero_serie=f'SN-DEMO-{index + 1001}',
                )
            )
        return customers, devices

    def build_ticket_flow(self, target_status):
        ordered = [
            Ticket.TicketStatus.INTAKE,
            Ticket.TicketStatus.DIAGNOSTIC,
            Ticket.TicketStatus.QUOTED,
            Ticket.TicketStatus.APPROVED,
            Ticket.TicketStatus.WAITING_PARTS,
            Ticket.TicketStatus.IN_REPAIR,
            Ticket.TicketStatus.IN_TESTING,
            Ticket.TicketStatus.READY,
            Ticket.TicketStatus.STORAGE,
            Ticket.TicketStatus.DELIVERED,
        ]
        index_map = {status: ordered.index(status) for status in ordered}
        return ordered[: index_map.get(target_status, 0) + 1]

    def seed_tickets(self):
        statuses = [
            Ticket.TicketStatus.INTAKE,
            Ticket.TicketStatus.DIAGNOSTIC,
            Ticket.TicketStatus.QUOTED,
            Ticket.TicketStatus.APPROVED,
            Ticket.TicketStatus.WAITING_PARTS,
            Ticket.TicketStatus.IN_REPAIR,
            Ticket.TicketStatus.IN_TESTING,
            Ticket.TicketStatus.READY,
            Ticket.TicketStatus.STORAGE,
            Ticket.TicketStatus.DELIVERED,
        ]
        descriptions = [
            'No enciende despues de apagado brusco.',
            'Pantalla parpadea y muestra lineas verticales.',
            'Equipo lento y con temperatura alta.',
            'Bateria no retiene carga.',
            'No detecta disco NVMe.',
            'Solicita instalacion limpia de Windows.',
            'Requiere recuperacion de archivos.',
            'Teclado con varias teclas sin respuesta.',
            'Demora excesiva en iniciar.',
            'Puerto de carga flojo.',
        ]
        diagnostico = self.find_subarea('Diagnóstico', 'Diagnostico')
        reparacion = self.find_subarea('Reparación', 'Reparacion')
        ensamblaje = self.find_subarea('Ensam')
        technicians = [self.users['tech_demo_1'], self.users['tech_demo_2']]

        tickets = []
        for index in range(10):
            ticket = create_ticket(
                customer=self.customers[index % len(self.customers)],
                user=self.users['recep_demo'],
                descripcion_problema=descriptions[index],
                device=self.devices[index % len(self.devices)],
                prioridad=Ticket.TicketPriority.MEDIUM if index < 7 else Ticket.TicketPriority.HIGH,
                assigned_to=technicians[index % 2],
                subarea=diagnostico,
            )
            ticket.estado = statuses[index]
            ticket.monto_estimado = Decimal(str(90 + (index * 25)))
            ticket.total = Decimal(str(120 + (index * 35)))
            ticket.diagnostico = f'Diagnostico demo {index + 1}: componente con desgaste.'
            ticket.solucion = f'Solucion demo {index + 1}: mantenimiento y reemplazo de pieza.' if index >= 5 else ''
            ticket.created_at = self.now - timedelta(days=10 - index)
            ticket.save()

            TicketTransition.objects.filter(ticket=ticket).delete()
            previous = None
            for step_number, state in enumerate(self.build_ticket_flow(ticket.estado)):
                transition = TicketTransition.objects.create(
                    ticket=ticket,
                    estado_anterior=previous,
                    estado_nuevo=state,
                    cambiado_por=self.users['recep_demo'] if step_number == 0 else technicians[index % 2],
                    motivo=f'Flujo demo hacia {state}',
                )
                TicketTransition.objects.filter(pk=transition.pk).update(created_at=ticket.created_at + timedelta(hours=step_number * 4))
                previous = state

            TicketService.objects.create(
                ticket=ticket,
                service=self.services[index % len(self.services)],
                precio_aplicado=self.services[index % len(self.services)].precio_base,
                aplicado_por=technicians[index % 2],
                notas='Servicio aplicado en demo',
            )
            TicketChecklistItem.objects.create(
                ticket=ticket,
                nombre='Limpieza final del equipo',
                requerido=True,
                completado=index >= 7,
                completado_por=technicians[index % 2] if index >= 7 else None,
                completado_el=self.now - timedelta(hours=8) if index >= 7 else None,
                orden=1,
            )
            TicketChecklistItem.objects.create(
                ticket=ticket,
                nombre='Prueba funcional completa',
                requerido=True,
                completado=index >= 6,
                completado_por=technicians[index % 2] if index >= 6 else None,
                completado_el=self.now - timedelta(hours=6) if index >= 6 else None,
                orden=2,
            )

            if index >= 4:
                TicketSubareaMovement.objects.create(
                    ticket=ticket,
                    subarea_origen=diagnostico,
                    subarea_destino=reparacion,
                    movido_por=technicians[index % 2],
                    notas='Movimiento demo a reparacion',
                )
                ticket.subarea = reparacion
                ticket.save(update_fields=['subarea'])
            if index >= 7:
                TicketSubareaMovement.objects.create(
                    ticket=ticket,
                    subarea_origen=reparacion,
                    subarea_destino=ensamblaje,
                    movido_por=technicians[index % 2],
                    notas='Movimiento demo a pruebas finales',
                )
                ticket.subarea = ensamblaje
                ticket.save(update_fields=['subarea'])

            if ticket.estado in [Ticket.TicketStatus.APPROVED, Ticket.TicketStatus.WAITING_PARTS, Ticket.TicketStatus.IN_REPAIR]:
                stock_item = StockItem.objects.filter(product=self.products[index % len(self.products)], warehouse=self.warehouses[0]).first()
                if stock_item:
                    reserve_stock(
                        stock_item=stock_item,
                        ticket=ticket,
                        quantity='1.000',
                        user=self.users['almacen_demo'],
                        notes='Reserva demo',
                    )

            tickets.append(ticket)

        warranty = create_warranty_ticket(
            source_ticket=tickets[-1],
            user=self.users['recep_demo'],
            descripcion_problema='Cliente reporta reincidencia cubierta por garantia.',
            prioridad=Ticket.TicketPriority.HIGH,
        )
        warranty.estado = Ticket.TicketStatus.DIAGNOSTIC
        warranty.diagnostico = 'Ingreso por garantia, revision prioritaria.'
        warranty.save(update_fields=['estado', 'diagnostico'])
        tickets.append(warranty)
        return tickets

    def seed_quotes(self):
        quote_statuses = [
            Quote.QuoteStatus.DRAFT,
            Quote.QuoteStatus.SENT,
            Quote.QuoteStatus.APPROVED,
            Quote.QuoteStatus.REJECTED,
            Quote.QuoteStatus.EXPIRED,
            Quote.QuoteStatus.SENT,
        ]
        quotes = []
        for index in range(6):
            ticket = self.tickets[index + 1]
            subtotal = self.products[index].precio_venta + self.services[index].precio_base
            descuento = Decimal('15.00') if index % 2 else Decimal('0.00')
            taxable = subtotal - descuento
            igv = (taxable * Decimal('0.18')).quantize(Decimal('0.01'))
            total = taxable + igv
            quote = Quote.objects.create(
                folio=generate_folio('COT'),
                version=1,
                customer=ticket.customer,
                device=ticket.device,
                source_ticket=ticket,
                created_by=self.users['recep_demo'],
                estado=quote_statuses[index],
                subtotal=subtotal,
                descuento=descuento,
                igv_rate=Decimal('18.00'),
                igv_amount=igv,
                total=total,
                valido_hasta=timezone.localdate() + timedelta(days=10 - index),
                condiciones='Pago 50% adelanto para repuestos especiales.',
                notas='Cotizacion demo de Fase 1.',
                is_active_version=True,
            )
            quote.base_quote = quote
            quote.save(update_fields=['base_quote'])
            QuoteLine.objects.create(
                quote=quote,
                line_type=QuoteLine.LineType.PRODUCT,
                product=self.products[index],
                descripcion=self.products[index].nombre,
                cantidad=Decimal('1.000'),
                precio_unitario=self.products[index].precio_venta,
                total_linea=self.products[index].precio_venta,
                supply_status=QuoteLine.SupplyStatus.RESERVED if index % 2 == 0 else QuoteLine.SupplyStatus.PENDING_ORDER,
                orden=1,
            )
            QuoteLine.objects.create(
                quote=quote,
                line_type=QuoteLine.LineType.SERVICE,
                service=self.services[index],
                descripcion=self.services[index].nombre,
                cantidad=Decimal('1.000'),
                precio_unitario=self.services[index].precio_base,
                total_linea=self.services[index].precio_base,
                supply_status=QuoteLine.SupplyStatus.NOT_APPLICABLE,
                orden=2,
            )
            if index in [2, 5]:
                QuoteApproval.objects.create(
                    quote=quote,
                    approval_type=QuoteApproval.ApprovalType.AMOUNT,
                    required_level=QuoteApproval.ApprovalLevel.ADMIN,
                    estado=QuoteApproval.ApprovalStatus.APPROVED if index == 2 else QuoteApproval.ApprovalStatus.PENDING,
                    decidido_por=self.users['admin'] if index == 2 else None,
                    decidido_el=self.now if index == 2 else None,
                    notas='Aprobacion demo por monto',
                )
            quotes.append(quote)
        return quotes

    def seed_finance(self):
        closure = CashClosure.objects.create(
            user=self.users['recep_demo'],
            estado=CashClosure.Status.OPEN,
            opening_amount=Decimal('250.00'),
        )
        financing_tickets = self.tickets[3:8]
        for index, ticket in enumerate(financing_tickets):
            schedules = create_payment_schedule(
                ticket=ticket,
                user=self.users['admin'],
                installments=[
                    {'amount': '120.00', 'due_date': timezone.localdate() - timedelta(days=5 - index)},
                    {'amount': '95.00', 'due_date': timezone.localdate() + timedelta(days=5 + index)},
                ],
            )
            Receipt.objects.create(
                folio=generate_folio('RC'),
                cash_closure=closure,
                ticket=ticket,
                tipo_recibo=Receipt.ReceiptType.ADVANCE if index % 2 == 0 else Receipt.ReceiptType.PAYMENT,
                metodo_pago=Receipt.PaymentMethod.CASH,
                amount=Decimal('120.00'),
                estado=Receipt.ReceiptStatus.CONFIRMED,
                registrado_por=self.users['recep_demo'],
                confirmado_por=self.users['recep_demo'],
                confirmado_el=self.now - timedelta(days=1),
            )
            schedules[0].monto_pagado = Decimal('120.00')
            schedules[0].esta_pagado = True
            schedules[0].pagado_el = self.now - timedelta(days=1)
            schedules[0].save(update_fields=['monto_pagado', 'esta_pagado', 'pagado_el', 'updated_at'])

            if index in [1, 3]:
                pending = Receipt.objects.create(
                    folio=generate_folio('RC'),
                    cash_closure=closure,
                    ticket=ticket,
                    tipo_recibo=Receipt.ReceiptType.INSTALLMENT,
                    metodo_pago=Receipt.PaymentMethod.TRANSFER,
                    amount=Decimal('95.00'),
                    referencia=f'TRX-DEMO-{index + 1}',
                    estado=Receipt.ReceiptStatus.PENDING,
                    registrado_por=self.users['recep_demo'],
                )
                if index == 3:
                    reversal = request_reversal(
                        receipt=pending,
                        user=self.users['admin'],
                        tipo_reversa=PaymentReversal.ReversalType.REVERSAL,
                        motivo='Operacion duplicada para demo',
                    )
                    decide_reversal(reversal=reversal, user=self.users['admin'], approve=False)

            if index in [0, 2]:
                discount = request_discount(
                    ticket=ticket,
                    user=self.users['recep_demo'],
                    tipo_descuento=Discount.DiscountType.FIXED_AMOUNT,
                    respuesta='20.00',
                    motivo='Ajuste comercial demo',
                )
                decide_discount(discount=discount, user=self.users['admin'], approve=index == 0, notas_admin='Revision demo')

        storage_ticket = next(ticket for ticket in self.tickets if ticket.estado == Ticket.TicketStatus.STORAGE)
        generate_storage_charges(ticket=storage_ticket, through_date=timezone.localdate())

    def seed_hr(self):
        staff = [
            self.users['recep_demo'],
            self.users['tech_demo_1'],
            self.users['tech_demo_2'],
            self.users['almacen_demo'],
            self.users['supervisor_demo'],
            self.users['admin_operaciones'],
        ]
        for index, user in enumerate(staff):
            schedule = WorkSchedule.objects.create(
                user=user,
                nombre='Turno regular',
                tardanza_tolerancia_min=5,
                descanso_maximo_min=45,
            )
            for day in range(5):
                WorkScheduleItem.objects.create(
                    work_schedule=schedule,
                    day_of_week=day,
                    start_time=time(8, 30),
                    end_time=time(18, 0),
                    is_day_off=False,
                )
            WorkScheduleItem.objects.create(
                work_schedule=schedule,
                day_of_week=5,
                start_time=time(0, 0),
                end_time=time(0, 0),
                is_day_off=True,
            )

            attendance_day = timezone.localdate() - timedelta(days=index % 3)
            clock_in = timezone.make_aware(datetime.combine(attendance_day, time(8, 35 + (index % 3))))
            clock_out = timezone.make_aware(datetime.combine(attendance_day, time(18, 5)))
            attendance = Attendance.objects.create(
                user=user,
                work_date=attendance_day,
                status=Attendance.Status.LATE if index % 3 == 1 else Attendance.Status.PRESENT,
                clock_in=clock_in,
                clock_out=clock_out,
                total_break_minutes=45,
                notes='Asistencia demo',
            )
            AttendanceBreak.objects.create(
                attendance=attendance,
                started_at=clock_in + timedelta(hours=4),
                ended_at=clock_in + timedelta(hours=4, minutes=45),
            )
            if index < 3:
                AttendanceCorrection.objects.create(
                    attendance=attendance,
                    requested_by=user,
                    motivo='Solicitud demo de correccion por marcacion tardia.',
                    proposed_clock_in=clock_in - timedelta(minutes=10),
                    estado=AttendanceCorrection.Status.PENDING if index == 0 else AttendanceCorrection.Status.APPROVED,
                    decided_by=self.users['admin'] if index != 0 else None,
                    decided_at=self.now if index != 0 else None,
                    admin_notes='Revision de demo',
                )
            Observation.objects.create(
                user=user,
                created_by=self.users['admin'],
                observation_type=Observation.Type.POSITIVE if index % 2 == 0 else Observation.Type.NOTE,
                mensaje='Observacion demo para pruebas de RRHH y panel administrativo.',
                observation_date=attendance_day,
            )
