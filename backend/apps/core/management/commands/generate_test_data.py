import random
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from faker import Faker
from django.utils import timezone
from datetime import timedelta

# Importar modelos
from apps.users.models import User, Role, UserRole
from apps.customers.models import Customer, Device
from apps.products.models import Product, Category, Brand, Warehouse, StockItem
from apps.tickets.models import Ticket, TicketTransition
from apps.finance.models import CashClosure, Receipt
from apps.core.utils import generate_folio

fake = Faker('es_PE')

class Command(BaseCommand):
    help = 'Genera datos de prueba realistas para probar el sistema (Clientes, Productos, Tickets, Pagos)'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("ATENCIÓN: Este comando generará datos aleatorios."))
        
        with transaction.atomic():
            self.generate_users()
            self.generate_inventory()
            self.generate_customers_and_devices()
            self.generate_tickets()
            self.generate_cash_closures()

        self.stdout.write(self.style.SUCCESS("¡Generación de datos de prueba exitosa!"))

    def generate_users(self):
        self.stdout.write("Generando usuarios de prueba...")
        roles = {
            'Recepcionista': 'recep1',
            'Técnico': 'tech1',
            'Almacenero': 'almacen1'
        }

        self.users = {}
        for role_name, username in roles.items():
            if not User.objects.filter(username=username).exists():
                user = User.objects.create_user(
                    username=username,
                    email=f"{username}@argos.local",
                    password='password123',
                    nombre=fake.name()
                )
                try:
                    role = Role.objects.get(nombre=role_name)
                    UserRole.objects.get_or_create(user=user, role=role)
                except Role.DoesNotExist:
                    pass
                self.users[role_name] = user
            else:
                self.users[role_name] = User.objects.get(username=username)
        
        self.admin = User.objects.filter(is_superuser=True).first()
        if not self.admin:
            self.admin = self.users['Recepcionista']

    def generate_inventory(self):
        self.stdout.write("Generando inventario...")
        
        # Categorías y Marcas
        cat_pantallas, _ = Category.objects.get_or_create(nombre='Pantallas')
        cat_ram, _ = Category.objects.get_or_create(nombre='Memoria RAM')
        cat_ssd, _ = Category.objects.get_or_create(nombre='Almacenamiento SSD')

        brand_hp, _ = Brand.objects.get_or_create(nombre='HP')
        brand_kingston, _ = Brand.objects.get_or_create(nombre='Kingston')
        brand_wd, _ = Brand.objects.get_or_create(nombre='Western Digital')

        warehouse, _ = Warehouse.objects.get_or_create(nombre='Almacén Principal')

        productos_data = [
            ("PANT-HP-15", "Pantalla HP 15.6 LED", cat_pantallas, brand_hp, 150.00, 250.00, 2),
            ("RAM-DDR4-8G", "Memoria RAM 8GB DDR4 3200MHz", cat_ram, brand_kingston, 60.00, 110.00, 5),
            ("RAM-DDR4-16G", "Memoria RAM 16GB DDR4 3200MHz", cat_ram, brand_kingston, 120.00, 200.00, 5),
            ("SSD-M2-500G", "SSD M.2 NVMe 500GB", cat_ssd, brand_wd, 110.00, 180.00, 3),
            ("SSD-M2-1T", "SSD M.2 NVMe 1TB", cat_ssd, brand_wd, 190.00, 280.00, 2),
        ]

        for codigo, nombre, cat, brand, costo, venta, min_stock in productos_data:
            prod, created = Product.objects.get_or_create(
                codigo=codigo,
                defaults={
                    'nombre': nombre,
                    'category': cat,
                    'brand': brand,
                    'precio_costo': Decimal(str(costo)),
                    'precio_venta': Decimal(str(venta)),
                    'stock_minimo': min_stock
                }
            )
            
            # Asignar stock inicial
            if created:
                # Algunos con stock bajo intencional para ver notificaciones
                cantidad = random.randint(1, 10)
                if '16G' in codigo or '1T' in codigo:
                    cantidad = 1 # Stock crítico forzado

                StockItem.objects.create(
                    product=prod,
                    warehouse=warehouse,
                    cantidad=cantidad
                )

    def generate_customers_and_devices(self):
        self.stdout.write("Generando clientes y dispositivos...")
        self.customers = []
        for _ in range(15):
            is_company = random.choice([True, False])
            customer = Customer.objects.create(
                tipo_cliente='EMPRESA' if is_company else 'PERSONA',
                identificador=fake.bban() if is_company else str(random.randint(10000000, 99999999)),
                nombre=fake.company() if is_company else fake.name(),
                telefono=fake.phone_number()[:15],
                correo_electronico=fake.email(),
                etiqueta=random.choice(['NUEVO', 'REGULAR', 'VIP', 'MOROSO']),
                direccion=fake.address()
            )
            self.customers.append(customer)

            # Generar 1-2 dispositivos por cliente
            for _ in range(random.randint(1, 2)):
                tipo = random.choice(['Laptop', 'PC de Escritorio', 'Celular', 'Impresora'])
                marca = random.choice(['Dell', 'HP', 'Lenovo', 'Asus', 'Apple', 'Samsung', 'Epson'])
                Device.objects.create(
                    customer=customer,
                    tipo_equipo=tipo,
                    marca=marca,
                    modelo=f"{marca} {random.randint(1000, 9000)}",
                    numero_serie=fake.ean8()
                )

    def generate_tickets(self):
        self.stdout.write("Generando tickets históricos y activos...")
        
        estados = [
            (Ticket.TicketStatus.INTAKE, 0),
            (Ticket.TicketStatus.DIAGNOSTIC, 1),
            (Ticket.TicketStatus.IN_REPAIR, 2),
            (Ticket.TicketStatus.READY, 3),
            (Ticket.TicketStatus.DELIVERED, 4),
        ]

        recepcionista = self.users.get('Recepcionista', self.admin)
        tecnico = self.users.get('Técnico', self.admin)

        for _ in range(30):
            customer = random.choice(self.customers)
            device = customer.devices.first()
            
            estado_target = random.choice(estados)
            estado_str, step = estado_target

            # Montos aleatorios
            monto_estimado = Decimal(str(random.randint(50, 500)))
            total = monto_estimado if step >= 1 else Decimal('0.00')

            ticket = Ticket.objects.create(
                folio=generate_folio('TKT'),
                customer=customer,
                device=device,
                descripcion_problema=fake.text(max_nb_chars=100),
                prioridad=random.choice(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
                estado=estado_str,
                assigned_to=tecnico if step >= 1 else None,
                created_by=recepcionista,
                monto_estimado=monto_estimado,
                total=total,
                diagnostico="Requiere mantenimiento general y cambio de pieza." if step >= 1 else None,
                solucion="Se limpió el equipo y se reemplazó el componente dañado." if step >= 3 else None,
            )

            # Historico de transiciones (simulado)
            past_date = timezone.now() - timedelta(days=random.randint(1, 10))
            ticket.created_at = past_date
            ticket.save()

            if step >= 4:
                # Simular pago completo para entregados
                Receipt.objects.create(
                    folio=generate_folio('RC'),
                    ticket=ticket,
                    cash_closure=self.get_or_create_dummy_closure(recepcionista, past_date),
                    tipo_recibo=Receipt.ReceiptType.PAYMENT,
                    metodo_pago='TRANSFER',
                    amount=total,
                    estado='CONFIRMED',
                    registrado_por=recepcionista,
                    confirmado_por=self.admin,
                    referencia=f"OPE-{random.randint(1000, 9999)}"
                )

    def get_or_create_dummy_closure(self, user, date):
        # Closure falso para pagos histA3ricos
        closure = CashClosure.objects.filter(user=user, opened_at__date=date.date()).first()
        if not closure:
            closure = CashClosure.objects.create(
                user=user,
                estado='CLOSED',
                opening_amount=Decimal('100.00'),
                expected_amount=Decimal('100.00'),
                declared_amount=Decimal('100.00'),
                difference=Decimal('0.00')
            )
            # Forzar fecha antigua (bypass auto_now_add)
            CashClosure.objects.filter(id=closure.id).update(opened_at=date, closed_at=date + timedelta(hours=8))
        return closure

    def generate_cash_closures(self):
        self.stdout.write("Configurando caja actual...")
        recepcionista = self.users.get('Recepcionista', self.admin)
        
        # Cerrar cualquier caja abierta primero
        CashClosure.objects.filter(user=recepcionista, estado='OPEN').update(estado='CLOSED', closed_at=timezone.now())

        # Abrir una nueva para hoy
        CashClosure.objects.create(
            user=recepcionista,
            estado='OPEN',
            opening_amount=Decimal('150.50')
        )
