# 🚀 Guía de Inicio Rápido - Argos ERP (MVP)

Este documento contiene las instrucciones básicas para levantar el sistema Argos ERP por primera vez en tu entorno local.

---

## 1. Requisitos Previos

Antes de comenzar, asegúrate de tener instalado en tu sistema:
- **Python 3.12+**
- **Node.js 18+** y **npm**
- **PostgreSQL 16** si vas a trabajar en modo PostgreSQL

---

## 2. Configuración de la Base de Datos

Argos ahora puede levantarse en dos modos:

- **PostgreSQL**: recomendado para uso normal y pruebas multiusuario.
- **SQLite**: útil para desarrollo local rápido cuando no quieres depender de PostgreSQL.

### Opción A: PostgreSQL

1. Abre tu gestor de base de datos (pgAdmin, DBeaver o la consola psql).
2. Crea una base de datos vacía llamada `argos_db`.
3. Asegúrate de tener un usuario y contraseña válidos para conectarte a PostgreSQL.

---

### Opción B: SQLite

Si quieres usar SQLite en local, no necesitas instalar PostgreSQL.

Solo define estas variables en tu `.env`:

```env
DB_ENGINE=sqlite
SQLITE_NAME=db.sqlite3
SQLITE_TIMEOUT=20
```

`db.sqlite3` se creará automáticamente dentro de la carpeta `backend/` cuando corras las migraciones.

## 3. Configuración del Backend (Django)

Abre una terminal y navega a la carpeta del backend:
```bash
cd argos-django/backend
```

1. **Crear y activar el entorno virtual:**
   ```bash
   python -m venv venv
   # En Windows:
   .\venv\Scripts\activate
   # En Linux/Mac:
   source venv/bin/activate
   ```

2. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configurar variables de entorno:**
   Copia el archivo `.env.example` (si existe) a `.env` o crea uno nuevo con el siguiente contenido base:
   ```env
   DEBUG=True
   SECRET_KEY=tu-clave-secreta-segura-aqui
   CORS_ALLOWED_ORIGINS=http://localhost:5173
   ```
   Luego completa una de estas dos configuraciones:

   **Modo PostgreSQL**
   ```env
   DB_ENGINE=postgresql
   DB_NAME=argos_db
   DB_USER=admin
   DB_PASSWORD=1234
   DB_HOST=127.0.0.1
   DB_PORT=5432
   ```

   **Modo SQLite**
   ```env
   DB_ENGINE=sqlite
   SQLITE_NAME=db.sqlite3
   SQLITE_TIMEOUT=20
   ```

4. **Aplicar migraciones:**
   ```bash
   python manage.py migrate
   ```

5. **Cargar los datos iniciales (Fixtures):**
   Este comando creará los roles, permisos, almacenes por defecto y el usuario administrador inicial.
   ```bash
   python manage.py setup_initial_data
   ```
   *Nota: Las credenciales por defecto del admin son usuario: `admin`, contraseña: `argos2025admin`.*

6. **Iniciar el servidor backend:**
   ```bash
   python manage.py runserver
   ```
   El backend estará corriendo en `http://localhost:8000/`.

### Limitaciones del modo SQLite

SQLite sirve bien para desarrollo local, pero debes considerar esto:

- no es la mejor opción para varios usuarios trabajando al mismo tiempo;
- los bloqueos transaccionales no son tan sólidos como en PostgreSQL;
- flujos delicados como reservas de stock, cobros, cuotas, órdenes de compra y generación de folios pueden ser más sensibles a concurrencia;
- para un entorno real del taller, sigue siendo mejor PostgreSQL.

---

## 4. Configuración del Frontend (React)

Abre otra terminal (manteniendo el backend corriendo) y navega a la carpeta del frontend:
```bash
cd argos-django/frontend
```

1. **Instalar dependencias de Node:**
   ```bash
   npm install
   ```

2. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   El frontend estará corriendo en `http://localhost:5173/`.

---

## 5. ¡A probar el sistema!

1. Abre tu navegador y ve a `http://localhost:5173/`.
2. Inicia sesión con las credenciales del administrador:
   - **Usuario:** `admin`
   - **Contraseña:** `argos2025admin`
3. Al ingresar, verás el Dashboard del Administrador.
4. Para simular el flujo completo, te sugerimos este orden:
   - Ve a **Configuración -> Usuarios** y crea un usuario con rol *Recepcionista* y otro con rol *Técnico*.
   - Inicia sesión como *Recepcionista*, abre la caja en el módulo de **Finanzas**, crea un **Cliente** y luego crea un **Ticket**.
   - Inicia sesión como *Técnico*, ve a la **Cola de Trabajo**, atiende el ticket, actualiza su estado hasta dejarlo "Listo" y fija los montos.
   - Vuelve a la cuenta de *Recepcionista*, registra el **Cobro** del ticket y finalmente pásalo a "Entregado".

---

## Notas para Producción (Red Local)

Cuando quieras instalar el sistema de manera permanente en el local físico (usando Gunicorn y Nginx):
1. Revisa el archivo `nginx/argos.conf` generado para configurar tu proxy inverso.
2. Modifica el `.env` del backend: pon `DEBUG=False` y ajusta `ALLOWED_HOSTS` a la IP de la máquina (ej: `192.168.1.10`).
3. En el frontend, construye el código para producción con `npm run build` y sirve la carpeta `dist/` a través de Nginx.
4. Programa el script `backup.sh` en el Cron de Linux para realizar copias de seguridad automáticas cada noche.
