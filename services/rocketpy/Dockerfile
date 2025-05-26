FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies needed for scientific packages
RUN apt-get update && apt-get install -y \
    build-essential \
    gfortran \
    libblas-dev \
    liblapack-dev \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directory for simulation results
RUN mkdir -p /app/data

# Create non-root user with explicit UID/GID
RUN groupadd --gid 1001 rocket && \
    useradd --uid 1001 --gid rocket --create-home --shell /bin/bash rocket
RUN chown -R rocket:rocket /app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Switch to non-root user
USER rocket

# Start the application
CMD ["python", "app.py"] 