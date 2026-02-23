FROM python:3.12-slim-bookworm

# system deps
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# working directory
WORKDIR /app

# install deps first (better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# copy app
COPY . .

# expose port
EXPOSE 8000

# run server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
