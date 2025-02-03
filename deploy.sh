#!/bin/bash

# Función para solicitar input con valor por defecto
ask_value() {
    local prompt="$1"
    local default="$2"
    local value

    echo -n "$prompt [$default]: "
    read value
    echo "${value:-$default}"
}

# Función para generar una contraseña aleatoria
generate_password() {
    openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 12
}

clear
echo "🚀 Whatic Installation Wizard"
echo "=============================="
echo "Por favor, proporciona la siguiente información:"
echo

# Recopilar información
DOMAIN=$(ask_value "Dominio (sin http/https)" "example.com")
ADMIN_EMAIL=$(ask_value "Email del administrador" "admin@$DOMAIN")
DB_PASS=$(ask_value "Contraseña de la base de datos" "$(generate_password)")
REDIS_PASS=$(ask_value "Contraseña de Redis" "$(generate_password)")

# Configuración del correo
SMTP_HOST=$(ask_value "Servidor SMTP" "smtp.gmail.com")
SMTP_PORT=$(ask_value "Puerto SMTP" "587")
SMTP_USER=$(ask_value "Usuario SMTP" "$ADMIN_EMAIL")
SMTP_PASS=$(ask_value "Contraseña SMTP" "")

# Confirmar configuración
echo
echo "📝 Resumen de la configuración:"
echo "=============================="
echo "Domain: $DOMAIN"
echo "Admin Email: $ADMIN_EMAIL"
echo "Database Password: $DB_PASS"
echo "Redis Password: $REDIS_PASS"
echo "SMTP: $SMTP_HOST:$SMTP_PORT"
echo

echo -n "¿Continuar con la instalación? [Y/n] "
read confirm
if [[ "$confirm" =~ ^[Nn] ]]; then
    echo "❌ Instalación cancelada"
    exit 1
fi

echo "🚀 Iniciando instalación..."

# Update system
echo "📦 Actualizando paquetes del sistema..."
sudo apt update && sudo apt upgrade -y

# Install dependencies if not present
command -v node >/dev/null 2>&1 || {
    echo "📥 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
    sudo apt-get install -y nodejs
}

command -v pm2 >/dev/null 2>&1 || {
    echo "📥 Instalando PM2..."
    sudo npm install -g pm2
}

# Install and configure PostgreSQL
echo "🐘 Instalando PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
echo "🗄️ Configurando base de datos PostgreSQL..."
sudo -u postgres psql -c "CREATE USER whatic WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE whatic_db WITH OWNER whatic;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE whatic_db TO whatic;"

# Install and configure Redis
echo "📦 Instalando Redis..."
sudo apt install -y redis-server

# Configure Redis
sudo sed -i 's/supervised no/supervised systemd/' /etc/redis/redis.conf
sudo sed -i 's/bind 127.0.0.1/bind 0.0.0.0/' /etc/redis/redis.conf
echo "requirepass $REDIS_PASS" | sudo tee -a /etc/redis/redis.conf

# Start Redis
sudo systemctl restart redis
sudo systemctl enable redis

# Backend deployment
echo "🔧 Configurando backend..."
cd backend
npm install
npm run build

# Setup backend environment
echo "⚙️ Configurando variables de entorno del backend..."
cat > .env << EOL
NODE_ENV=production
BACKEND_URL=https://$DOMAIN
FRONTEND_URL=https://$DOMAIN
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
npm run db:migrate
npm run db:seed

# Start backend with PM2
pm2 delete whatic-backend 2>/dev/null || true
pm2 start dist/server.js --name whatic-backend

# Frontend deployment
echo "🎨 Configurando frontend..."
cd ../frontend
npm install
npm run build

# Setup frontend environment
cat > .env << EOL
REACT_APP_BACKEND_URL=https://$DOMAIN
REACT_APP_HOURS_CLOSE_TICKETS_AUTO=24
EOL

# Install certbot
echo "🔒 Instalando Certbot..."
sudo apt-get install -y certbot python3-certbot-nginx

# Setup nginx
echo "🌐 Configurando Nginx..."
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Create nginx configuration
sudo tee /etc/nginx/sites-available/whatic << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        root /var/www/whatic;
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
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

# Enable the site
sudo ln -s /etc/nginx/sites-available/whatic /etc/nginx/sites-enabled/ 2>/dev/null || true
sudo rm -f /etc/nginx/sites-enabled/default

# Copy frontend build to nginx directory
sudo mkdir -p /var/www/whatic
sudo cp -r build/* /var/www/whatic/

# Restart nginx
sudo systemctl restart nginx

# Install SSL certificate
echo "🔒 Instalando certificado SSL..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $ADMIN_EMAIL

# Save PM2 process list and configure startup
pm2 save
pm2 startup

echo "✅ ¡Instalación completada!"
echo
echo "📝 Credenciales y Detalles:"
echo "============================"
echo "URL del sistema: https://$DOMAIN"
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
echo "🔒 SSL: Certificado instalado automáticamente"
echo
echo "💡 Recomendaciones:"
echo "1. Guarda estas credenciales en un lugar seguro"
echo "2. Cambia las contraseñas del panel de administración"
echo "3. Configura copias de seguridad regulares"
echo
echo "Para ver los logs del sistema:"
echo "- Backend: pm2 logs whatic-backend"
echo "- Nginx: sudo tail -f /var/log/nginx/error.log"
