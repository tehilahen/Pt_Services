FROM node:20-bookworm

# Install system dependencies (SQLite via Python stdlib — no ODBC)
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    python3-venv \
    curl \
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
