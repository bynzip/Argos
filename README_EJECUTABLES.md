# Ejecutables de Argos

Usa estos archivos con doble clic:

- `start.bat`: inicia el sistema con Docker y abre Argos en Edge/Chrome con un perfil temporal controlado.
- `stop.bat`: apaga los contenedores sin borrar datos, cierra la ventana de Argos y limpia los temporales del perfil controlado.
- `ejecutables/interno/update.bat`: actualiza/reconstruye imagenes cuando se instala una nueva version.
- `backup.bat`: crea un respaldo en `datos/backups`.
- `restore.bat`: restaura automaticamente el backup mas reciente de `datos/backups`.

La carpeta `datos` no se borra automaticamente desde estos ejecutables.
