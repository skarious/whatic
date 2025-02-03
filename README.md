# WhatsApp SaaS Platform

## 🚀 Requisitos del Sistema

- Node.js 16.x o superior
- MySQL/MariaDB
- PM2 (para gestión de procesos)
- Nginx
- Linux (Ubuntu/Debian recomendado)

## 📋 Instalación en VPS

1. Clonar el repositorio:
```bash
git clone https://github.com/skarious/whatic.git
cd whatic
```

2. Dar permisos de ejecución al script de despliegue:
```bash
chmod +x deploy.sh
```

3. Ejecutar el script de despliegue:
```bash
./deploy.sh
```

4. Configurar variables de entorno:
   - Backend: Copiar `.env.example` a `.env` y configurar
   - Frontend: Copiar `.env.exemple` a `.env` y configurar

5. Configurar SSL (recomendado):
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx
```

## 🛠️ Configuración Manual

### Backend
```bash
cd backend
npm install
npm run build
npm run db:migrate
npm run db:seed
```

### Frontend
```bash
cd frontend
npm install
npm run build
```

## 📝 Variables de Entorno

### Backend (.env)
- `DB_HOST`: Host de la base de datos
- `DB_USER`: Usuario de la base de datos
- `DB_PASS`: Contraseña de la base de datos
- `DB_NAME`: Nombre de la base de datos
- `JWT_SECRET`: Clave secreta para JWT
- `JWT_REFRESH_SECRET`: Clave secreta para refresh token

### Frontend (.env)
- `REACT_APP_BACKEND_URL`: URL del backend
- `REACT_APP_HOURS_CLOSE_TICKETS_AUTO`: Tiempo para cierre automático de tickets

## 🔧 Mantenimiento

- Logs del backend: `pm2 logs whaticket-backend`
- Reiniciar servicios: `pm2 restart all`
- Estado de servicios: `pm2 status`

## 🆘 Soporte

Para soporte, por favor abrir un issue en el repositorio.
