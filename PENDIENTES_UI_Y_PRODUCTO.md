# Pendientes de UI y Producto

Este documento resume lo que sigue pendiente despues de la pasada de correcciones logicas y de los ajustes puntuales de UX ya aplicados.

## Ya resuelto en esta pasada

- Error visible y guia al campo DNI/RUC al fallar la creacion de cliente.
- Feedback de guardado en diagnostico tecnico.
- Feedback de guardado en borrador de cotizacion.
- Timeline del ticket con eventos mas recientes arriba y contenedor con scroll.
- Versiones de cotizacion en una pildora desplegable.
- Enlace al ticket desde la vista de cotizacion.
- Acciones de aprobacion y rechazo del cliente separadas visualmente del resto.

## Pendientes de experiencia de usuario

### 1. Separacion visual mas fuerte en el detalle del ticket

Sigue pendiente reorganizar con mas criterio visual las zonas de:

- datos del cliente y equipo
- diagnostico
- checklist
- reservas
- historial
- pagos

No se toco aun porque conviene revisarlo completo como una mini pasada de diseno, no como cambios aislados.

### 2. Cola de trabajo del tecnico

Sigue abierta la decision de producto entre:

- cola compartida por area
- asignacion individual visible por tecnico

No se implemento porque depende de una decision operativa del taller.

## Pendientes funcionales o de producto

### 3. Checklist por tipo de trabajo o plantilla aplicable

Hoy el checklist existe, pero todavia no hay modelo funcional completo para decir:

- este tipo de trabajo requiere checklist
- esta plantilla aplica a este ticket
- este ticket puede pasar a listo sin checklist

No se hizo aun porque requiere definir reglas de negocio y probablemente nuevas entidades o configuraciones administrativas.

### 4. Borrador tecnico de repuestos y servicios dentro del ticket

Todavia falta la seccion donde el tecnico pueda proponer repuestos o servicios necesarios sin entrar al modulo formal de cotizaciones ni ver precios.

No se implemento porque es un flujo nuevo, no un ajuste menor de UI.

### 5. Cuotas desde el flujo de cobro

La recepcionista todavia no tiene una interfaz para:

- elegir pago en cuotas
- definir numero de cuotas
- fijar o sugerir vencimientos
- confirmar el cronograma

No se hizo aun porque es una funcionalidad completa nueva de interfaz y validaciones.

### 6. Venta directa sin ticket

Sigue faltando el flujo de venta directa para productos sin reparacion.

No se implemento porque implica separar parte del flujo comercial del dominio de tickets:

- cotizacion directa
- aprobacion
- cobro
- salida de stock
- registro de caja

### 7. Aprobacion administrativa formal del cierre de caja con diferencia

Ya existe:

- nota obligatoria
- bloqueo por pagos pendientes
- notificacion al administrador

Pero todavia no existe el flujo formal para que el admin marque el cierre como:

- aprobado
- observado

No se hizo porque ya entra en un cambio de estado y control administrativo mas grande.

### 8. Dashboard de recepcionista para "Listos para entregar"

Ya existe la notificacion interna al pasar el ticket a `READY`, pero falta pulir la presentacion especifica en dashboard para que la seccion sea mas visible y accionable.

## Recomendacion para la siguiente pasada

Orden sugerido:

1. Redisenar detalle del ticket.
2. Definir decision de cola tecnica.
3. Definir modelo de checklist por plantilla.
4. Diseñar borrador tecnico de repuestos.
5. Construir cuotas.
6. Diseñar venta directa sin ticket.
7. Cerrar flujo administrativo de caja con diferencia.
