FROM python:3.12-slim

WORKDIR /app

# System deps for reportlab (fonts) and pptx
RUN apt-get update && apt-get install -y \
    gcc \
    libfreetype6-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Temp directory for file uploads
RUN mkdir -p temp

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

