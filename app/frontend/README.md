# Frontend portable

El frontend no usa un contenedor propio en el despliegue cliente.

La imagen `nginx` compila `frontend/` con `npm run build` en una etapa Node y copia el resultado a nginx para servirlo como archivos estaticos de produccion.
