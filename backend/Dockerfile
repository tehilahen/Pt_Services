# Use an official lightweight Python image
FROM 684610983594.dkr.ecr.il-central-1.amazonaws.com/global-repo:molsa-python-3.11

# Install dependencies including Perl libraries for Nikto
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    apt-transport-https \
    lsb-release \
    unixodbc \
    unixodbc-dev \
    libnet-ssleay-perl \
    libio-socket-ssl-perl \
    libwww-perl \
    libjson-pp-perl \
    libtime-hires-perl \
    libtime-local-perl \
    libnet-perl \
    perl-modules \
    && rm -rf /var/lib/apt/lists/*

# Add Microsoft repository and install ODBC driver
RUN curl -sSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor \
    | tee /etc/apt/trusted.gpg.d/microsoft.gpg > /dev/null \
    && curl -sSL https://packages.microsoft.com/config/ubuntu/22.04/prod.list \
    | tee /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql17 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /app

# Set environment variables
# SQL_CONNECTION_STRING צריך להיות מועבר בזמן הרצה עם -e (מסיבות אבטחה)
# דוגמה: docker run -e SQL_CONNECTION_STRING="Driver={ODBC Driver 17 for SQL Server};Server=...;UID=...;PWD=...;"
ENV FLASK_HOST=0.0.0.0 \
    FLASK_PORT=5000 \
    FLASK_DEBUG=True \
    WATCH_FOLDER="nikto output" \
    ARCHIVE_FOLDER=archive

# Copy requirements (if any) and install dependencies
COPY requirements.txt .
RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org \
    --proxy http://192.168.174.80:8080 --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY . .

# Make Nikto executable
RUN chmod +x /app/nikto_service/program/nikto.pl

# Command to run the app
CMD ["python", "main.py"]
