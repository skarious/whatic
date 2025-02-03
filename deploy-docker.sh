#!/bin/bash

echo "🐳 Iniciando despliegue con Docker..."

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# Verificar si Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Crear directorio para nginx
mkdir -p nginx/conf.d nginx/certificates

# Construir y levantar los contenedores
echo "🚀 Construyendo y levantando contenedores..."
docker-compose up -d --build

# Ejecutar migraciones
echo "🔄 Ejecutando migraciones de la base de datos..."
docker-compose exec backend npm run db:migrate
docker-compose exec backend npm run db:seed

echo "✅ Despliegue completado!"
echo
echo "📝 Servicios disponibles en:"
echo "- Frontend: http://localhost:3000"
echo "- Backend: http://localhost:8080"
echo "- Base de datos: localhost:5432"
echo "- Redis: localhost:6379"
echo
echo "💡 Para ver los logs:"
echo "docker-compose logs -f"
echo
echo "Para detener los servicios:"
echo "docker-compose down"
