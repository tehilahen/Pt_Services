FROM node:20-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    gnupg2 \
    unixodbc \
    unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

# Install ODBC Driver 17 for SQL Server
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql17 \
    && rm -rf /var/lib/apt/lists/*

# Install Cursor CLI globally
RUN npm install -g @anthropic-ai/cursor-cli || echo "Cursor CLI install attempted"

WORKDIR /work

# Create Python virtual environment and install dependencies
RUN python3 -m venv /work/venv
COPY requirements.txt /work/requirements.txt
RUN /work/venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY scripts/ /work/scripts/
COPY templates/ /work/templates/
COPY entrypoint.sh /work/entrypoint.sh
RUN chmod +x /work/entrypoint.sh

# Create output and logs directories
RUN mkdir -p /work/output /work/logs /work/repo

ENV PATH="/work/venv/bin:$PATH"

ENTRYPOINT ["/work/entrypoint.sh"]
