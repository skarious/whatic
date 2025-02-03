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

# Backend deployment
echo "🔧 Setting up backend..."
cd backend
npm install
npm run build
cp .env.example .env

echo "⚙️ Starting database migrations..."
npm run db:migrate
npm run db:seed

# Start backend with PM2
pm2 delete whaticket-backend 2>/dev/null || true
pm2 start dist/server.js --name whaticket-backend

# Frontend deployment
echo "🎨 Setting up frontend..."
cd ../frontend
npm install
npm run build
cp .env.exemple .env

# Setup nginx for frontend
echo "🌐 Configuring nginx..."
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Create nginx configuration
sudo tee /etc/nginx/sites-available/whaticket << EOF
server {
    listen 80;
    server_name \$YOUR_DOMAIN;  # Replace with your domain

    location / {
        root /var/www/whaticket;
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
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/whaticket /etc/nginx/sites-enabled/ 2>/dev/null || true

# Copy frontend build to nginx directory
sudo mkdir -p /var/www/whaticket
sudo cp -r build/* /var/www/whaticket/

# Restart nginx
sudo systemctl restart nginx

echo "✅ Deployment completed!"
echo "🌟 Remember to:"
echo "1. Configure your .env files"
echo "2. Set up SSL with Certbot"
echo "3. Update the nginx configuration with your domain"
