FROM python:3.10-slim

WORKDIR /app

# Umgebungsvariablen setzen
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV BACKEND_URL=http://backend:8000
ENV JWT_SECRET=your_super_secret_key_for_docker

# Abhängigkeiten kopieren und installieren
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Anwendungscode kopieren
COPY . /app/

# Startbefehl
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"] 