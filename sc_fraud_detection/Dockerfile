FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

COPY wait-for-opensearch.sh /wait-for-opensearch.sh
RUN chmod +x /wait-for-opensearch.sh

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
