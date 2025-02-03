#!/bin/bash

# Función para manejar errores
handle_error() {
    echo "❌ Error: $1"
    exit 1
}

# Función para solicitar input con timeout
ask_value_with_timeout() {
    local prompt="$1"
    local default="$2"
    local value
    local timeout=30

    # Usar read con timeout
    echo -n "$prompt [$default]: "
    if read -t $timeout value; then
        echo "${value:-$default}"
    else
        echo "$default"
    fi
}

# Función para generar una contraseña aleatoria
generate_password() {
    < /dev/urandom tr -dc 'A-Za-z0-9' | head -c12 || echo "defaultpass123"
}

# Capturar errores
trap 'handle_error "Se produjo un error inesperado en la línea $LINENO"' ERR

clear
echo "🚀 Whatic Installation Wizard"
echo "=============================="
echo "Iniciando instalación automática..."
echo

# Configurar valores por defecto
FRONTEND_DOMAIN=${1:-"app.example.com"}
BACKEND_DOMAIN=${2:-"api.example.com"}
ADMIN_EMAIL=${3:-"admin@$FRONTEND_DOMAIN"}
DB_PASS=$(generate_password)
REDIS_PASS=$(generate_password)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="$ADMIN_EMAIL"
SMTP_PASS="your-email-password"

echo "📝 Usando la siguiente configuración:"
echo "===================================="
echo "Frontend Domain: $FRONTEND_DOMAIN"
echo "Backend Domain: $BACKEND_DOMAIN"
echo "Admin Email: $ADMIN_EMAIL"
echo "Database Password: $DB_PASS"
echo "Redis Password: $REDIS_PASS"
echo

# Continuar automáticamente después de 5 segundos
echo "Iniciando instalación en 5 segundos..."
sleep 5

echo "🚀 Iniciando instalación..."

# Update system
echo "📦 Actualizando paquetes del sistema..."
sudo apt update && sudo apt upgrade -y || handle_error "Error actualizando el sistema"

# Install dependencies if not present
command -v node >/dev/null 2>&1 || {
    echo "📥 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash - || handle_error "Error configurando Node.js"
    sudo apt-get install -y nodejs || handle_error "Error instalando Node.js"
}

command -v pm2 >/dev/null 2>&1 || {
    echo "📥 Instalando PM2..."
    sudo npm install -g pm2 || handle_error "Error instalando PM2"
}

# Install and configure PostgreSQL
echo "🐘 Instalando PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib || handle_error "Error instalando PostgreSQL"

# Start PostgreSQL
sudo systemctl start postgresql || handle_error "Error iniciando PostgreSQL"
sudo systemctl enable postgresql

# Create database and user
echo "🗄️ Configurando base de datos PostgreSQL..."
sudo -u postgres psql -c "CREATE USER whatic WITH PASSWORD '$DB_PASS';" || handle_error "Error creando usuario de base de datos"
sudo -u postgres psql -c "CREATE DATABASE whatic_db WITH OWNER whatic;" || handle_error "Error creando base de datos"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE whatic_db TO whatic;" || handle_error "Error asignando privilegios"

# Install and configure Redis
echo "📦 Instalando Redis..."
sudo apt install -y redis-server || handle_error "Error instalando Redis"

# Configure Redis
sudo sed -i 's/supervised no/supervised systemd/' /etc/redis/redis.conf
sudo sed -i 's/bind 127.0.0.1/bind 0.0.0.0/' /etc/redis/redis.conf
echo "requirepass $REDIS_PASS" | sudo tee -a /etc/redis/redis.conf

# Start Redis
sudo systemctl restart redis || handle_error "Error iniciando Redis"
sudo systemctl enable redis

# Backend deployment
echo "🔧 Configurando backend..."
cd backend || handle_error "Error accediendo al directorio backend"
npm install --no-audit || handle_error "Error instalando dependencias del backend"
npm run build || handle_error "Error compilando el backend"

# Setup backend environment
echo "⚙️ Configurando variables de entorno del backend..."
cat > .env << EOL
NODE_ENV=production
BACKEND_URL=https://$BACKEND_DOMAIN
FRONTEND_URL=https://$FRONTEND_DOMAIN
PROXY_PORT=8080
PORT=8080

DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=whatic
DB_PASS=$DB_PASS
DB_NAME=whatic_db

JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

REDIS_URI=redis://:$REDIS_PASS@127.0.0.1:6379
REDIS_OPT_LIMITER_MAX=1
REDIS_OPT_LIMITER_DURATION=3000

USER_LIMIT=10000
CONNECTIONS_LIMIT=100000
CLOSED_SEND_BY_ME=true

MAIL_HOST=$SMTP_HOST
MAIL_USER=$SMTP_USER
MAIL_PASS=$SMTP_PASS
MAIL_FROM="Whatic <$SMTP_USER>"
MAIL_PORT=$SMTP_PORT
EOL

echo "⚙️ Iniciando migraciones de base de datos..."
npm run db:migrate || handle_error "Error en las migraciones"
npm run db:seed || handle_error "Error en el seeding"

# Start backend with PM2
pm2 delete whatic-backend 2>/dev/null || true
pm2 start dist/server.js --name whatic-backend || handle_error "Error iniciando el backend"

# Frontend deployment
echo "🎨 Configurando frontend..."
cd ../frontend || handle_error "Error accediendo al directorio frontend"
npm install --no-audit || handle_error "Error instalando dependencias del frontend"
npm run build || handle_error "Error compilando el frontend"

# Setup frontend environment
cat > .env << EOL
REACT_APP_BACKEND_URL=https://$BACKEND_DOMAIN
REACT_APP_HOURS_CLOSE_TICKETS_AUTO=24
EOL

# Install certbot
echo "🔒 Instalando Certbot..."
sudo apt-get install -y certbot python3-certbot-nginx || handle_error "Error instalando Certbot"

# Setup nginx
echo "🌐 Configurando Nginx..."
sudo apt-get install -y nginx || handle_error "Error instalando Nginx"
sudo systemctl start nginx
sudo systemctl enable nginx

# Create nginx configuration for frontend
echo "📝 Configurando Nginx para Frontend..."
sudo tee /etc/nginx/sites-available/whatic-frontend << EOF
server {
    listen 80;
    server_name $FRONTEND_DOMAIN;

    location / {
        root /var/www/whatic;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# Create nginx configuration for backend
echo "📝 Configurando Nginx para Backend..."
sudo tee /etc/nginx/sites-available/whatic-backend << EOF
server {
    listen 80;
    server_name $BACKEND_DOMAIN;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /socket.io {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the sites
sudo ln -s /etc/nginx/sites-available/whatic-frontend /etc/nginx/sites-enabled/ 2>/dev/null || true
sudo ln -s /etc/nginx/sites-available/whatic-backend /etc/nginx/sites-enabled/ 2>/dev/null || true
sudo rm -f /etc/nginx/sites-enabled/default

# Copy frontend build to nginx directory
sudo mkdir -p /var/www/whatic
sudo cp -r build/* /var/www/whatic/

# Restart nginx
sudo systemctl restart nginx || handle_error "Error reiniciando Nginx"

# Install SSL certificates
echo "🔒 Instalando certificados SSL..."
sudo certbot --nginx -d $FRONTEND_DOMAIN --non-interactive --agree-tos --email $ADMIN_EMAIL || echo "⚠️ Warning: Error al instalar SSL para frontend"
sudo certbot --nginx -d $BACKEND_DOMAIN --non-interactive --agree-tos --email $ADMIN_EMAIL || echo "⚠️ Warning: Error al instalar SSL para backend"

# Save PM2 process list and configure startup
pm2 save
pm2 startup

echo "✅ ¡Instalación completada!"
echo
echo "📝 Credenciales y Detalles:"
echo "============================"
echo "URLs del sistema:"
echo "- Frontend: https://$FRONTEND_DOMAIN"
echo "- Backend: https://$BACKEND_DOMAIN"
echo "Email admin: $ADMIN_EMAIL"
echo
echo "Database:"
echo "- Nombre: whatic_db"
echo "- Usuario: whatic"
echo "- Contraseña: $DB_PASS"
echo
echo "Redis:"
echo "- Contraseña: $REDIS_PASS"
echo
echo "🔒 SSL: Certificados instalados automáticamente"
echo
echo "💡 Recomendaciones:"
echo "1. Guarda estas credenciales en un lugar seguro"
echo "2. Cambia las contraseñas del panel de administración"
echo "3. Configura copias de seguridad regulares"
echo
echo "Para ver los logs del sistema:"
echo "- Backend: pm2 logs whatic-backend"
echo "- Nginx: sudo tail -f /var/log/nginx/error.log"
