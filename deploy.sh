#!/bin/bash

echo "🚀 Starting deployment process..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install dependencies if not present
command -v node >/dev/null 2>&1 || {
    echo "📥 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
    sudo apt-get install -y nodejs
}

command -v pm2 >/dev/null 2>&1 || {
    echo "📥 Installing PM2..."
    sudo npm install -g pm2
}

# Install and configure PostgreSQL
echo "🐘 Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
echo "🗄️ Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE USER whatic WITH PASSWORD 'whatic123';"
sudo -u postgres psql -c "CREATE DATABASE whatic_db WITH OWNER whatic;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE whatic_db TO whatic;"

# Install and configure Redis
echo "📦 Installing Redis..."
sudo apt install -y redis-server

# Configure Redis to start on boot and bind to all interfaces
sudo sed -i 's/supervised no/supervised systemd/' /etc/redis/redis.conf
sudo sed -i 's/bind 127.0.0.1/bind 0.0.0.0/' /etc/redis/redis.conf

# Set Redis password
echo "requirepass 123456" | sudo tee -a /etc/redis/redis.conf

# Start Redis
sudo systemctl restart redis
sudo systemctl enable redis

# Backend deployment
echo "🔧 Setting up backend..."
cd backend
npm install
npm run build

# Setup backend environment
echo "⚙️ Configuring backend environment..."
cat > .env << EOL
NODE_ENV=production
BACKEND_URL=http://localhost
FRONTEND_URL=http://localhost:3000
PROXY_PORT=8080
PORT=8080

DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=whatic
DB_PASS=whatic123
DB_NAME=whatic_db

JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

REDIS_URI=redis://:123456@127.0.0.1:6379
REDIS_OPT_LIMITER_MAX=1
REDIS_OPT_LIMITER_DURATION=3000

USER_LIMIT=10000
CONNECTIONS_LIMIT=100000
CLOSED_SEND_BY_ME=true
EOL

echo "⚙️ Starting database migrations..."
npm run db:migrate
npm run db:seed

# Start backend with PM2
pm2 delete whatic-backend 2>/dev/null || true
pm2 start dist/server.js --name whatic-backend

# Frontend deployment
echo "🎨 Setting up frontend..."
cd ../frontend
npm install
npm run build

# Setup frontend environment
cat > .env << EOL
REACT_APP_BACKEND_URL=http://localhost:8080
REACT_APP_HOURS_CLOSE_TICKETS_AUTO=24
EOL

# Setup nginx for frontend
echo "🌐 Configuring nginx..."
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Create nginx configuration
sudo tee /etc/nginx/sites-available/whatic << EOF
server {
    listen 80;
    server_name \$YOUR_DOMAIN;  # Replace with your domain

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

# Copy frontend build to nginx directory
sudo mkdir -p /var/www/whatic
sudo cp -r build/* /var/www/whatic/

# Restart nginx
sudo systemctl restart nginx

# Save PM2 process list and configure startup
pm2 save
pm2 startup

echo "✅ Deployment completed!"
echo "🌟 Remember to:"
echo "1. Update the nginx configuration with your domain name"
echo "2. Set up SSL with Certbot using: sudo certbot --nginx"
echo "3. Configure your email settings in backend/.env"
echo "4. Update frontend/.env with your domain"

# Print credentials
echo -e "\n📝 Database Credentials:"
echo "Database Name: whatic_db"
echo "Database User: whatic"
echo "Database Password: whatic123"
echo -e "\n📝 Redis Password: 123456"
