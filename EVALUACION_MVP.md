# 📋 Plan de Evaluación del MVP - Argos ERP

Este documento contiene un plan paso a paso estructurado como **Casos de Prueba (Test Cases)**. Te permitirá validar manualmente que todas las funcionalidades críticas acordadas para el **MVP** están presentes y funcionan según las Reglas de Negocio (RN).

---

## 🔐 1. Autenticación y Control de Accesos

**Objetivo:** Verificar que los roles existan y que la seguridad de las rutas funcione.

*   [ ] **Acceso denegado sin sesión:** Abre el navegador en modo incógnito e intenta ir a `http://localhost:5173/dashboard`. El sistema debe redirigirte inmediatamente al `/login`.
*   [ ] **Login exitoso:** Inicia sesión con el usuario `admin` y contraseña `argos2025admin`. Debes acceder al Dashboard y ver el sidebar completo con todos los módulos.
*   [ ] **Restricción de vistas por rol:** Entra con la cuenta de un Técnico (ej: `tech1` / `password123`). Verifica en el menú lateral que **NO** tiene acceso a Finanzas ni a Usuarios.

---

## 👥 2. Clientes y Dispositivos

**Objetivo:** Verificar la gestión del directorio de clientes.

*   [ ] **Crear un Cliente:** Ve al módulo de Clientes y crea uno nuevo. Intenta poner un DNI que ya exista (ej: el de algún cliente de los datos de prueba); el sistema debe rechazarlo o advertir duplicidad.
*   [ ] **Detalle e Historial:** Haz clic en un cliente existente. Debes ver su etiqueta (ej: VIP, Nuevo), su historial (vacío o con tickets de prueba) y la lista de sus dispositivos.
*   [ ] **Registrar Dispositivo:** En la vista del cliente, añade un nuevo dispositivo (ej: "Laptop HP Pavilion"). Asegúrate de que aparezca listado.

---

## 📦 3. Catálogo e Inventario Básico

**Objetivo:** Verificar que el catálogo exista y respete las reglas de visibilidad de costos.

*   [ ] **Visibilidad del Administrador:** Como Admin o Almacenero, entra a Inventario. Verifica que en la tabla puedes ver las columnas de **Precio de Venta** y **Precio de Costo**.
*   [ ] **Regla de Negocio (RN-15):** Cierra sesión e ingresa como Recepcionista. Ve a Inventario. Verifica que el **Precio de Costo es invisible** para este perfil.
*   [ ] **Alerta de Stock:** Como Admin o Almacenero, verifica en tu Dashboard si hay un cuadro rojo o alerta de "Stock Bajo" (esto asumiendo que el cron o los datos de prueba dejaron productos en 0 o 1).

---

## 🎟️ 4. Flujo Core de Tickets (El corazón del sistema)

**Objetivo:** Simular el ciclo de vida completo de una laptop dañada que entra al local.

### Paso 4.1: Recepción (Rol: Recepcionista)
*   [ ] **Crear el Ticket:** Entra como Recepcionista. Ve a Tickets -> Nuevo. Selecciona un cliente, su dispositivo y describe el problema ("Pantalla rota"). 
*   [ ] **Accesorios y Fotos:** Agrega al menos un accesorio ("Cargador original") y sube una imagen de prueba como evidencia. Guarda el ticket.
*   [ ] **Validación:** Verifica que se haya generado un folio único (ej: `TKT-2024-xxxx`) y que el estado inicial sea **Ingreso**.

### Paso 4.2: Taller (Rol: Técnico o Admin)
*   [ ] **Cola del Técnico:** Inicia sesión como Técnico y ve a "Mi Cola de Trabajo" (o ve al detalle del ticket como Admin).
*   [ ] **Diagnóstico:** Actualiza el estado a **Diagnóstico**. Entra al detalle y comprueba que la transición se registró en el "Timeline" (línea de tiempo a la derecha).
*   [ ] **Actualizar Montos:** Como técnico (o admin), utiliza el botón "Actualizar Montos" en el detalle del ticket para fijar un Total de reparación (ej: S/ 150.00).
*   [ ] **Avanzar hasta Listo:** Mueve el ticket por los estados: `En reparación` -> `En pruebas` -> `Listo`.

### Paso 4.3: Intento de Entrega (Regla RN-01)
*   [ ] **Bloqueo por deuda:** Como Recepcionista, entra al ticket que está "Listo". Intenta cambiar el estado a **Entregado**. El sistema **DEBE IMPEDIRLO** y lanzar un error porque el saldo pendiente (S/ 150.00) es mayor a 0.

---

## 💰 5. Finanzas, Caja y Pagos

**Objetivo:** Verificar la recaudación de dinero y el cierre del ticket.

### Paso 5.1: Apertura de Caja
*   [ ] **Abrir Turno:** Como Recepcionista, ve al módulo de Finanzas. Si la caja está cerrada, ingresa un "Fondo Inicial" (ej: S/ 50.00) y ábrela.

### Paso 5.2: Cobro
*   [ ] **Pagar el Ticket:** Ve al ticket que dejaste "Listo" en el paso 4. Haz clic en "Registrar Cobro".
*   [ ] **Pago en Efectivo (RN-06):** Ingresa S/ 150.00 como Efectivo. El pago debe auto-confirmarse y el saldo del ticket debe bajar a S/ 0.00.
*   [ ] **Liberación:** Ahora que el saldo es 0, el sistema debe permitirte mover el ticket al estado **Entregado**.

### Paso 5.3: Cierre de Caja
*   [ ] **Cuadre Físico:** Vuelve al módulo de Finanzas (Caja). Verifica que el "Efectivo Físico Esperado" sume el fondo inicial + los pagos en efectivo del día (50 + 150 = 200).
*   [ ] **Cerrar Turno:** Ingresa S/ 200.00 como monto declarado y cierra la caja. 

---

## 📊 6. Dashboards y Notificaciones

**Objetivo:** Validar que la información se resume correctamente.

*   [ ] **Métricas en Vivo:** Ve al Dashboard del Admin. Revisa si los "Tickets Activos" y las ventas coinciden con lo que acabas de operar.
*   [ ] **Campana de Alertas:** Revisa el icono de la campana (arriba a la derecha). Si el script de prueba generó stock bajo, debes ver notificaciones. Míralas y haz clic en "Marcar todas leídas".

---

Si logras tachar todas estas casillas sin que el sistema explote o te muestre una pantalla en blanco, **¡El MVP es un éxito total y está listo para ser presentado/usado!**
