import os
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.users.models import User, Role, Permission, Area, Subarea, RolePermission, UserRole

class Command(BaseCommand):
    help = 'Configura los datos iniciales (roles, permisos, áreas, usuario admin) para Argos ERP.'

    def handle(self, *args, **kwargs):
        self.stdout.write("Iniciando carga de datos semilla (Fixtures)...")

        with transaction.atomic():
            self._create_permissions()
            self._create_roles_and_assign_permissions()
            self._create_areas_and_subareas()
            self._create_admin_user()

        self.stdout.write(self.style.SUCCESS("Datos iniciales cargados correctamente."))

    def _create_permissions(self):
        perms = [
            # Users
            ("users.view_list", "Ver lista de usuarios", "users"),
            ("users.create", "Crear usuario", "users"),
            ("users.edit", "Editar usuario", "users"),
            ("users.suspend", "Suspender / reactivar usuario", "users"),
            ("users.change_password", "Cambiar contraseña de un usuario", "users"),
            # Customers
            ("customers.view_list", "Ver lista de clientes", "customers"),
            ("customers.view_detail", "Ver detalle del cliente", "customers"),
            ("customers.create", "Crear cliente", "customers"),
            ("customers.edit", "Editar cliente", "customers"),
            ("customers.deactivate", "Desactivar cliente", "customers"),
            ("customers.change_label", "Cambiar etiqueta del cliente manualmente", "customers"),
            # Devices
            ("devices.view_list", "Ver dispositivos de un cliente", "devices"),
            ("devices.create", "Registrar dispositivo", "devices"),
            ("devices.edit", "Editar dispositivo", "devices"),
            # Tickets
            ("tickets.view_list", "Ver lista de todos los tickets", "tickets"),
            ("tickets.view_own", "Ver solo los tickets asignados al propio usuario", "tickets"),
            ("tickets.view_detail", "Ver detalle de un ticket", "tickets"),
            ("tickets.create", "Crear ticket de ingreso", "tickets"),
            ("tickets.upload_evidence", "Subir fotos de evidencia", "tickets"),
            ("tickets.assign_technician", "Asignar o reasignar técnico", "tickets"),
            ("tickets.transition_reception", "Mover ticket en estados de recepción", "tickets"),
            ("tickets.transition_technical", "Mover ticket en estados técnicos", "tickets"),
            ("tickets.reserve_parts", "Reservar repuestos del inventario", "tickets"),
            ("tickets.view_readonly", "Ver ticket en modo solo lectura", "tickets"),
            # Quotes
            ("quotes.view_list", "Ver lista de cotizaciones", "quotes"),
            ("quotes.view_detail", "Ver detalle de cotización", "quotes"),
            ("quotes.view_draft", "Ver borradores de cotización", "quotes"),
            ("quotes.create", "Crear cotización", "quotes"),
            ("quotes.send", "Enviar cotización al cliente", "quotes"),
            ("quotes.approve", "Marcar cotización como aprobada", "quotes"),
            ("quotes.reject", "Marcar cotización como rechazada", "quotes"),
            ("quotes.convert_to_ticket", "Convertir cotización aprobada en ticket", "quotes"),
            ("quotes.approve_multinivel", "Aprobar cotizaciones de alto monto", "quotes"),
            # Services
            ("services.view_list", "Ver lista de servicios", "services"),
            ("services.view_detail", "Ver detalle de servicio", "services"),
            ("services.create", "Crear servicio", "services"),
            ("services.edit", "Editar servicio", "services"),
            # Inventory
            ("inventory.view_catalog", "Ver catálogo de productos", "inventory"),
            ("inventory.create_product", "Crear producto en el catálogo", "inventory"),
            ("inventory.edit_product", "Editar producto", "inventory"),
            ("inventory.deactivate_product", "Desactivar producto", "inventory"),
            ("inventory.view_cost", "Ver precio de costo", "inventory"),
            ("inventory.view_stock", "Ver niveles de stock", "inventory"),
            ("inventory.reserve_stock", "Reservar stock para un ticket", "inventory"),
            ("inventory.manage_movements", "Registrar movimientos de inventario", "inventory"),
            ("inventory.adjust_stock", "Hacer ajuste manual de stock", "inventory"),
            ("inventory.transfer_stock", "Transferir stock entre almacenes", "inventory"),
            # Suppliers
            ("suppliers.view", "Ver proveedores", "suppliers"),
            ("suppliers.create", "Crear proveedor", "suppliers"),
            ("suppliers.edit", "Editar proveedor", "suppliers"),
            ("suppliers.manage_orders", "Crear y gestionar órdenes de compra", "suppliers"),
            # Finance
            ("finance.view_cash", "Ver estado de la caja", "finance"),
            ("finance.open_close_cash", "Abrir y cerrar caja", "finance"),
            ("finance.register_payment", "Registrar pago", "finance"),
            ("finance.confirm_payment", "Confirmar pagos digitales", "finance"),
            ("finance.request_discount", "Solicitar descuento", "finance"),
            ("finance.approve_discount", "Aprobar o rechazar descuentos", "finance"),
            ("finance.request_reversal", "Solicitar reversa de pago", "finance"),
            ("finance.approve_reversal", "Aprobar o rechazar reversas de pago", "finance"),
            ("finance.view_receipts", "Ver recibos de pago", "finance"),
            ("finance.manage_schedules", "Gestionar cronogramas de cuotas y reprogramaciones", "finance"),
            # HR
            ("hr.mark_attendance", "Marcar entrada, descanso y salida propias", "hr"),
            ("hr.view_own_attendance", "Ver historial de asistencia propio", "hr"),
            ("hr.view_all_attendance", "Ver asistencia de todos los empleados", "hr"),
            ("hr.manage_schedules", "Crear y editar horarios de trabajo", "hr"),
            ("hr.approve_corrections", "Aprobar solicitudes de corrección de asistencia", "hr"),
            ("hr.manage_observations", "Registrar observaciones sobre empleados", "hr"),
            ("hr.manage_holidays", "Gestionar feriados y días no laborables", "hr"),
            # Reports
            ("reports.view_financial", "Ver reportes financieros", "reports"),
            ("reports.view_inventory", "Ver reportes de inventario", "reports"),
            ("reports.view_attendance", "Ver reportes de asistencia", "reports"),
            ("reports.export", "Exportar reportes a Excel/PDF", "reports"),
            # Config
            ("config.view", "Ver parámetros del sistema", "config"),
            ("config.edit", "Editar parámetros del sistema", "config"),
            # Audit
            ("audit.view", "Ver log de auditoría", "audit"),
        ]

        created_count = 0
        for code, name, module in perms:
            _, created = Permission.objects.get_or_create(
                code=code,
                defaults={'name': name, 'module': module}
            )
            if created:
                created_count += 1
        self.stdout.write(f"- Permisos: {created_count} creados.")

    def _create_roles_and_assign_permissions(self):
        roles_data = {
            "Administrador": [],  # Admin doesn't need explicit perms
            "Recepcionista": [
                "customers.view_list", "customers.view_detail", "customers.create", "customers.edit",
                "devices.view_list", "devices.create", "devices.edit",
                "tickets.view_list", "tickets.view_detail", "tickets.create", "tickets.upload_evidence", "tickets.transition_reception",
                "quotes.view_list", "quotes.view_detail", "quotes.create", "quotes.send", "quotes.approve", "quotes.reject", "quotes.convert_to_ticket",
                "services.view_list", "services.view_detail",
                "inventory.view_catalog", "inventory.view_stock",
                "finance.view_cash", "finance.open_close_cash", "finance.register_payment", "finance.request_discount", "finance.view_receipts",
                "hr.mark_attendance", "hr.view_own_attendance"
            ],
            "Técnico": [
                "customers.view_detail",
                "devices.view_list",
                "tickets.view_own", "tickets.view_detail", "tickets.upload_evidence", "tickets.transition_technical", "tickets.reserve_parts",
                "quotes.view_draft",
                "services.view_list", "services.view_detail",
                "inventory.view_catalog", "inventory.view_stock", "inventory.reserve_stock",
                "hr.mark_attendance", "hr.view_own_attendance"
            ],
            "Almacenero": [
                "tickets.view_readonly",
                "quotes.view_list",
                "services.view_list",
                "inventory.view_catalog", "inventory.view_cost", "inventory.view_stock", "inventory.manage_movements", "inventory.adjust_stock", "inventory.transfer_stock", "inventory.create_product", "inventory.edit_product",
                "suppliers.view", "suppliers.create", "suppliers.edit", "suppliers.manage_orders",
                "reports.view_inventory",
                "hr.mark_attendance", "hr.view_own_attendance"
            ]
        }

        for role_name, perm_codes in roles_data.items():
            role, created = Role.objects.get_or_create(nombre=role_name)
            if created:
                self.stdout.write(f"- Rol '{role_name}' creado.")

            # Assign permissions
            for code in perm_codes:
                try:
                    perm = Permission.objects.get(code=code)
                    RolePermission.objects.get_or_create(role=role, permission=perm)
                except Permission.DoesNotExist:
                    self.stdout.write(self.style.WARNING(f"  Warning: Permiso {code} no encontrado."))

    def _create_areas_and_subareas(self):
        areas_data = {
            "Taller": ["Diagnóstico", "Reparación", "Ensamblaje"],
            "Ventas / Recepción": ["Recepción"],
            "Almacén": ["Almacén Principal"],
            "Administración": []
        }

        for area_name, subareas in areas_data.items():
            area, _ = Area.objects.get_or_create(nombre=area_name)
            for sub_name in subareas:
                Subarea.objects.get_or_create(area=area, nombre=sub_name)
        
        self.stdout.write(f"- Áreas y Subáreas verificadas/creadas.")

    def _create_admin_user(self):
        admin_user = os.getenv('ADMIN_USERNAME', 'admin')
        admin_pass = os.getenv('ADMIN_PASSWORD', 'argos2025admin')
        admin_email = os.getenv('ADMIN_EMAIL', 'admin@argos.local')

        if not User.objects.filter(username=admin_user).exists():
            user = User.objects.create_superuser(
                username=admin_user,
                email=admin_email,
                password=admin_pass,
                nombre='Super Administrador'
            )
            # Assign 'Administrador' role just in case
            admin_role = Role.objects.get(nombre="Administrador")
            UserRole.objects.get_or_create(user=user, role=admin_role)
            self.stdout.write(f"- Usuario admin '{admin_user}' creado.")
        else:
            self.stdout.write(f"- Usuario admin '{admin_user}' ya existe.")
