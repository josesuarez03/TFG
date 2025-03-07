FROM python:3.13.1-slim

# Establecer el directorio de trabajo en el contenedor
WORKDIR /app

# Copiar los archivos necesarios
COPY requirements.txt .

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente del servicio Django
COPY django_services ./django_services


# Exponer el puerto en el que corre Django (por defecto 8000)
EXPOSE 8000

# Comando para ejecutar el servidor de desarrollo de Django
CMD ["python", "manage.py", "migrate"] && ["python", "manage.py", "runserver", "0.0.0.0:8000"]