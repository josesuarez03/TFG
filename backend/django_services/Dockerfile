FROM python:3.13.1-slim

# Establecer el directorio de trabajo en el contenedor
WORKDIR /app

# Copiar todo el código del proyecto Django
COPY django_services /app/

# Copiar requirements.txt
COPY requirements.txt /app/

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Exponer el puerto en el que corre Django
EXPOSE 8000

# Comando para ejecutar el servidor de desarrollo de Django
CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]