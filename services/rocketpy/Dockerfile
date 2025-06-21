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
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# ✅ FIX: Create geomagindices data directory with proper permissions after package installation
RUN mkdir -p /usr/local/lib/python3.11/site-packages/geomagindices/data && \
    chmod -R 777 /usr/local/lib/python3.11/site-packages/geomagindices/data

# ✅ FIX: Create msise00 build directory with proper permissions for CMake
RUN mkdir -p /usr/local/lib/python3.11/site-packages/msise00/build && \
    chmod -R 777 /usr/local/lib/python3.11/site-packages/msise00

# Copy application code
COPY . .

# Create data directory for simulation results
RUN mkdir -p /app/data

# Create non-root user with explicit UID/GID
RUN groupadd --gid 1001 rocket && \
    useradd --uid 1001 --gid rocket --create-home --shell /bin/bash rocket

# ✅ FIX: Create writable home directory for geomagindices data with proper permissions
# The geomagindices library will automatically create its data directory in the user's home
RUN mkdir -p /home/rocket/.geomagindices && \
    chown -R rocket:rocket /home/rocket && \
    chmod -R 755 /home/rocket

# Set ownership of app directory
RUN chown -R rocket:rocket /app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
# ✅ FIX: Set HOME directory so geomagindices can write to user's home
ENV HOME=/home/rocket

# Switch to non-root user
USER rocket

# Start the application
CMD ["python", "app.py"] 