#!/bin/bash

echo "🐳 Iniciando despliegue con Docker..."

# Función para manejar errores
handle_error() {
    echo "❌ Error: $1"
    exit 1
}

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh || handle_error "No se pudo descargar el script de Docker"
    sudo sh get-docker.sh || handle_error "Error instalando Docker"
    sudo usermod -aG docker $USER || handle_error "Error configurando permisos de Docker"
    rm get-docker.sh
fi

# Verificar si Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose || handle_error "Error descargando Docker Compose"
    sudo chmod +x /usr/local/bin/docker-compose || handle_error "Error configurando Docker Compose"
fi

# Instalar dependencias necesarias
echo "📦 Instalando dependencias necesarias..."
sudo apt-get update
sudo apt-get install -y netcat-openbsd || handle_error "Error instalando netcat"

# Crear directorios necesarios
echo "📁 Creando directorios..."
mkdir -p nginx/conf.d nginx/certificates || handle_error "Error creando directorios"

# Detener contenedores existentes
echo "🛑 Deteniendo contenedores existentes..."
docker-compose down

# Limpiar imágenes antiguas
echo "🧹 Limpiando imágenes antiguas..."
docker image prune -f

# Construir y levantar los contenedores
echo "🚀 Construyendo y levantando contenedores..."
docker-compose up -d --build || handle_error "Error construyendo contenedores"

# Esperar a que la base de datos esté lista
echo "⏳ Esperando a que la base de datos esté lista..."
sleep 10

# Ejecutar migraciones
echo "🔄 Ejecutando migraciones de la base de datos..."
docker-compose exec -T backend npm run db:migrate || echo "⚠️ Warning: Error en las migraciones"
docker-compose exec -T backend npm run db:seed || echo "⚠️ Warning: Error en el seeding"

echo "✅ Despliegue completado!"
echo
echo "📝 Servicios disponibles en:"
echo "- Frontend: http://localhost:3000"
echo "- Backend: http://localhost:8080"
echo "- Base de datos: localhost:5432"
echo "- Redis: localhost:6379"
echo
echo "💡 Comandos útiles:"
echo "- Ver logs: docker-compose logs -f"
echo "- Reiniciar servicios: docker-compose restart"
echo "- Detener servicios: docker-compose down"
echo "- Ver estado de los servicios: docker-compose ps"
echo
echo "🔍 Para verificar el estado de los servicios:"
docker-compose ps
