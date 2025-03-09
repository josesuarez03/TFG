FROM python:3.13.1-slim

# Establecer el directorio de trabajo en el contenedor
WORKDIR /app

# Copiar requirements.txt
COPY requirements.txt requirements.txt

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copiar toda la estructura de flask-services
COPY flask-services /app/flask-services

# Exponer el puerto en el que corre Flask
EXPOSE 5000

# Comando para ejecutar el servidor de desarrollo de Flask
CMD ["python", "flask-services/src/app.py"]