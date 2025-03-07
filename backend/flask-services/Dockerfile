FROM python:3.13.1-slim

# Establecer el directorio de trabajo en el contenedor
WORKDIR /app

# Copiar los archivos necesarios
COPY ../requirements.txt ./


# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente del servicio Flask
COPY ../flask-services ./flask-services

EXPOSE 5000

CMD ["python", "flask-services/app.py"]

