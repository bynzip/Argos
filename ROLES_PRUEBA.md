# 👥 Usuarios y Roles para Pruebas del MVP

Este documento detalla las credenciales de los usuarios generados para realizar las pruebas del sistema Argos ERP (versión MVP), así como las capacidades exactas que cada uno tiene según las Reglas de Negocio (RN) y la matriz de permisos.

---

## 🔴 Administrador (Dueño / Gerente)
**Usuario:** `admin`
**Contraseña:** `argos2025admin`

Es el superusuario del sistema. Tiene acceso total a todos los módulos y es el único que puede ver información confidencial y aprobar operaciones sensibles.

**Capacidades en el MVP:**
- **Acceso Total:** Puede navegar por todos los módulos del menú lateral (Dashboard, Tickets, Clientes, Inventario, Finanzas, Usuarios).
- **Dashboard Global (`DASH-01`):** Ve métricas financieras, cantidad de tickets activos, clientes registrados y productos en el catálogo.
- **Precios de Costo (`RN-15`):** Al ingresar al módulo de Inventario, es el único (junto al almacenero) que puede ver la columna "Precio de Costo".
- **Gestión de Usuarios (`CFG-03`):** Puede crear, editar y suspender el acceso de otros empleados.
- **Caja y Pagos:** Puede abrir/cerrar caja y registrar cobros.
- **Tickets:** Puede reasignar técnicos, editar clientes y mover los tickets por cualquier estado de la máquina de estados. Puede actualizar los montos (Monto Estimado y Total Final) desde el detalle del ticket.

---

## 🔵 Recepcionista (Atención al cliente / Cajero)
**Usuario:** `recep1`
**Contraseña:** `password123`

Es el primer contacto con el cliente. Maneja la entrada de equipos, la caja diaria y la entrega final.

**Capacidades en el MVP:**
- **Dashboard (`DASH-02`):** Ve el estado de su caja (abierta/cerrada) y los tickets que ya están listos para entregar.
- **Restricción de Módulos:** NO puede acceder a la gestión de "Usuarios" ni a la parte profunda de "RRHH". 
- **Flujo de Caja (`RN-09`):** Debe abrir su caja obligatoriamente al inicio del turno declarando un fondo inicial. Al final del día, debe cerrarla declarando el monto físico exacto.
- **Gestión de Clientes:** Puede registrar nuevos clientes (DNI/RUC) y registrar nuevos dispositivos asociados a ellos.
- **Creación de Tickets:** Puede crear tickets nuevos, adjuntar accesorios e imágenes de evidencia.
- **Cobros (`RN-06`):** Puede registrar pagos. Si cobra en Efectivo, se auto-confirma. Si cobra en Yape/Transferencia, el sistema le exigirá la referencia y subir la foto del voucher.
- **Entrega Condicionada (`RN-01`):** Solo puede mover un ticket al estado `Entregado` si el saldo pendiente es estrictamente `S/ 0.00`. Si hay deuda, el sistema la bloqueará.
- **Restricción Técnica:** NO puede mover un ticket a estados como `En Reparación` o `En Pruebas`. Solo opera la entrada y la salida.
- **Restricción de Costos (`RN-15`):** Si entra a Inventario, solo verá el Precio de Venta. El Precio de Costo estará oculto.

---

## 🟢 Técnico (Taller)
**Usuario:** `tech1`
**Contraseña:** `password123`

Especialista en reparaciones. Su interfaz está enfocada en la eficiencia técnica, limpia de temas financieros.

**Capacidades en el MVP:**
- **Dashboard (`DASH-03`):** Ve la cantidad de tickets que tiene asignados y su estado actual.
- **Cola de Trabajo (`TKT-04`):** Tiene un acceso rápido a un tablero Kanban simplificado (`/tickets/queue`) donde ve sus tickets ordenados por prioridad y puede moverlos de estado rápidamente.
- **Flujo Técnico:** Es el responsable de mover el ticket a través de `Diagnóstico` -> `En Reparación` -> `En Pruebas` -> `Listo`.
- **Registro de Soluciones:** Puede actualizar el diagnóstico técnico y la solución aplicada. 
- **Actualizar Montos:** En el MVP, el técnico tiene el botón para establecer el Monto Estimado y el Total a Cobrar al terminar la reparación.
- **Restricción de Módulos:** NO puede acceder a "Finanzas", "Usuarios" ni puede registrar cobros.
- **Restricción de Costos (`RN-15`):** Si entra a Inventario para buscar repuestos, solo verá el Precio de Venta.

---

## 🟡 Almacenero (Logística)
**Usuario:** `almacen1`
**Contraseña:** `password123`

Custodio del inventario. Garantiza el control del catálogo.

**Capacidades en el MVP:**
- **Dashboard (`DASH-04`):** Ve un resumen enfocado en las alertas de productos con stock bajo o crítico.
- **Gestión de Catálogo:** Puede crear nuevos productos, categorías y marcas.
- **Visibilidad de Costos:** Al igual que el Administrador, SI puede ver los Precios de Costo en la tabla de inventario y en el detalle del producto.
- **Notificaciones Automáticas:** Su campanita de alertas en el menú superior recibirá notificaciones generadas por el sistema cuando el cron detecte que un producto cayó por debajo del `stock_minimo`.
- **Restricción de Módulos:** NO puede acceder a "Finanzas", "Usuarios", ni puede alterar el ciclo de los tickets (los ve en modo solo lectura). No gestiona clientes.
