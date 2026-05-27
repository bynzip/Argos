# Guia de Inicio Rapido - Argos ERP (PostgreSQL)

Este documento contiene las instrucciones basicas para levantar Argos ERP en entorno local usando PostgreSQL.

---

## 1. Requisitos Previos

Antes de comenzar, asegurate de tener instalado en tu sistema:

- **Python 3.12+**
- **Node.js 18+** y **npm**
- **PostgreSQL 16**

---

## 2. Configuracion de la Base de Datos

1. Abre tu gestor de base de datos o la consola `psql`.
2. Crea una base de datos vacia llamada `argos_db` o la que prefieras usar.
3. Asegurate de tener un usuario y contrasena validos para conectarte a PostgreSQL.

---

## 3. Configuracion del Backend (Django)

Abre una terminal y navega a la carpeta del backend:

```bash
cd backend
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

Copia `.env.example` a `.env` y ajusta los valores de PostgreSQL:

```env
DEBUG=True
SECRET_KEY=tu-clave-secreta-segura-aqui
CORS_ALLOWED_ORIGINS=http://localhost:5173

DB_NAME=argos_db
DB_USER=admin
DB_PASSWORD=1234
DB_HOST=127.0.0.1
DB_PORT=5432
```

4. **Aplicar migraciones:**

```bash
python manage.py migrate
```

5. **Cargar datos base:**

```bash
python manage.py setup_initial_data
```

Esto crea roles, permisos, areas, subareas y el usuario administrador inicial.

Credenciales admin por defecto:

- **Usuario:** `admin`
- **Contrasena:** `argos2025admin`

6. **Opcional: cargar datos demo mas completos**

```bash
python manage.py seed_phase1_demo_data
```

Este comando crea ejemplos operativos de clientes, productos, tickets, cotizaciones, compras, finanzas y RRHH.

7. **Iniciar el servidor backend:**

```bash
python manage.py runserver
```

El backend quedara disponible en:

- `http://localhost:8000/`

---

## 4. Configuracion del Frontend (React)

Abre otra terminal y navega a la carpeta del frontend:

```bash
cd frontend
```

1. **Instalar dependencias:**

```bash
npm install
```

2. **Iniciar servidor de desarrollo:**

```bash
npm run dev
```

El frontend quedara disponible en:

- `http://localhost:5173/`

---

## 5. Prueba Basica del Sistema

1. Abre `http://localhost:5173/`.
2. Inicia sesion con:
   - **Usuario:** `admin`
   - **Contrasena:** `argos2025admin`
3. Verifica que cargue el dashboard.
4. Para un flujo basico de prueba:
   - crea usuarios de recepcion y tecnico;
   - crea un cliente;
   - registra un ticket;
   - genera una cotizacion o monto rapido;
   - registra un pago;
   - revisa inventario, compras y reportes.

---

## 6. Notas de Produccion Local

Si luego se instala en una red local o entorno mas permanente:

1. ajusta `DEBUG=False`;
2. configura `ALLOWED_HOSTS` con la IP o nombre del equipo;
3. compila frontend con `npm run build`;
4. sirve `dist/` con nginx;
5. configura respaldos periodicos de PostgreSQL y archivos `media/`.
