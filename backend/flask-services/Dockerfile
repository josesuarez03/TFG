FROM python:3.13.1-slim

WORKDIR /app

# Instalar dependencias del microservicio Flask
COPY flask-services/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copiar código del microservicio Flask
COPY flask-services /app/flask-services

EXPOSE 5000

CMD ["python", "flask-services/src/app.py"]