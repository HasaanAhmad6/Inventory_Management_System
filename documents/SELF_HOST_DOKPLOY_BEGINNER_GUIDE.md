# Windows Laptop Self-Hosting Guide (Beginner, First Time)

This guide is for learning and testing on your own Windows laptop as a server.

It gives you two paths:
- Path A (recommended first): Docker Desktop + Docker Compose (easiest)
- Path B (after learning): Dokploy inside WSL2 Ubuntu

Use Path A first. When you are comfortable, move to Path B.

## Important reality check

Using a laptop as server is fine for learning/testing, but not ideal for real production because:
- Laptop can sleep/shutdown
- Home internet/public IP can change
- Port forwarding and security are harder

Still, this is perfect for learning deployment.

---

## 1. What you need

1. Windows 10/11 (Windows 11 preferred)
2. Admin access on your laptop
3. Stable internet
4. This project code on your laptop

---

## 2. Install required tools on Windows

## 2.1 Install WSL2

Open PowerShell as Administrator and run:

~~~powershell
wsl --install
~~~

Restart Windows when prompted.

After restart, install Ubuntu from Microsoft Store (if not auto-installed), open it, and set your Linux username/password.

Verify:

~~~powershell
wsl -l -v
~~~

You should see Ubuntu running with Version 2.

## 2.2 Install Docker Desktop

1. Download Docker Desktop from the official Docker website.
2. Install it.
3. During install, keep "Use WSL2" enabled.
4. Start Docker Desktop.

In Docker Desktop settings:
1. Go to Settings -> General:
- Keep "Use the WSL 2 based engine" enabled.
2. Go to Settings -> Resources -> WSL Integration:
- Enable Ubuntu integration.

Verify in PowerShell:

~~~powershell
docker --version
docker compose version
~~~

---

## 3. Project changes needed before deployment

You need 2 app-level changes:
1. Django settings must use environment variables.
2. Frontend API URL must be environment-based.

## 3.1 Update backend settings

File: backend/settings.py

### 3.1.1 Add import

Near top, add:

~~~python
import os
~~~

### 3.1.2 Replace secret/debug/hosts

Use:

~~~python
SECRET_KEY = os.getenv('SECRET_KEY', 'change-this-in-production')
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
ALLOWED_HOSTS = [h.strip() for h in os.getenv('ALLOWED_HOSTS', '127.0.0.1,localhost').split(',') if h.strip()]
~~~

### 3.1.3 Replace database config

Use:

~~~python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('POSTGRES_DB', 'inventory_db'),
        'USER': os.getenv('POSTGRES_USER', 'postgres'),
        'PASSWORD': os.getenv('POSTGRES_PASSWORD', ''),
        'HOST': os.getenv('POSTGRES_HOST', 'db'),
        'PORT': os.getenv('POSTGRES_PORT', '5432'),
    }
}
~~~

### 3.1.4 Replace CORS/CSRF config

Use:

~~~python
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.getenv('CORS_ALLOWED_ORIGINS', 'http://127.0.0.1:8080').split(',') if o.strip()]
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.getenv('CSRF_TRUSTED_ORIGINS', 'http://127.0.0.1:8080').split(',') if o.strip()]
CORS_ALLOW_CREDENTIALS = True
~~~

Keep your existing STATIC_ROOT and MEDIA_ROOT settings.

## 3.2 Update frontend API base URL

File: frontend/src/api/axios.js

Use:

~~~javascript
import axios from 'axios';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/',
});

API.interceptors.request.use((config) => {
    const token = localStorage.getItem('access');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

API.interceptors.response.use(
    (response) => response,
    async (error) => {
        const requestUrl = String(error.config?.url || '');
        const isLoginRequest = requestUrl.includes('auth/login/');
        if (error.config?.responseType === 'blob') return Promise.reject(error);
        if (error.response?.status === 401 && !isLoginRequest) {
            localStorage.removeItem('access');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default API;
~~~

File: frontend/.env.production

~~~env
VITE_API_BASE_URL=http://YOUR_LAPTOP_IP:8000/api/
~~~

---

## 4. Create deployment files in project root

Create these files in the project root (same level as manage.py).

## 4.1 Dockerfile.backend

~~~dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn psycopg2-binary

COPY . .

EXPOSE 8000
~~~

## 4.2 Dockerfile.frontend

~~~dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
~~~

## 4.3 .dockerignore

~~~dockerignore
.git
.venv
.vscode
__pycache__
*.pyc
node_modules
frontend/node_modules
dist
frontend/dist
~~~

## 4.4 docker-compose.yml

~~~yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    restart: unless-stopped
    depends_on:
      - db
    environment:
      SECRET_KEY: ${SECRET_KEY}
      DEBUG: ${DEBUG}
      ALLOWED_HOSTS: ${ALLOWED_HOSTS}
      CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS}
      CSRF_TRUSTED_ORIGINS: ${CSRF_TRUSTED_ORIGINS}
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_HOST: ${POSTGRES_HOST}
      POSTGRES_PORT: ${POSTGRES_PORT}
    ports:
      - "8000:8000"
    volumes:
      - media_data:/app/media
      - static_data:/app/staticfiles
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             gunicorn backend.wsgi:application --bind 0.0.0.0:8000 --workers 3"

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "8080:80"

volumes:
  pg_data:
  media_data:
  static_data:
~~~

## 4.5 .env file (project root)

~~~env
SECRET_KEY=CHANGE_TO_A_LONG_RANDOM_SECRET
DEBUG=False
ALLOWED_HOSTS=127.0.0.1,localhost,YOUR_LAPTOP_IP
CORS_ALLOWED_ORIGINS=http://127.0.0.1:8080,http://YOUR_LAPTOP_IP:8080
CSRF_TRUSTED_ORIGINS=http://127.0.0.1:8080,http://YOUR_LAPTOP_IP:8080

POSTGRES_DB=inventory_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_TO_STRONG_PASSWORD
POSTGRES_HOST=db
POSTGRES_PORT=5432
~~~

---

## 5. Run app using Docker Compose (Path A - recommended first)

From project root in PowerShell:

~~~powershell
docker compose up -d --build
~~~

Check status:

~~~powershell
docker compose ps
~~~

View logs if needed:

~~~powershell
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
~~~

Open in browser:
- http://127.0.0.1:8080
- or http://YOUR_LAPTOP_IP:8080 (for other devices in same Wi-Fi)

Create superuser:

~~~powershell
docker compose exec backend python manage.py createsuperuser
~~~

---

## 6. Allow access from other devices on same network

## 6.1 Find your laptop LAN IP

PowerShell:

~~~powershell
ipconfig
~~~

Look for IPv4 address (example: 192.168.1.25).

## 6.2 Open Windows Firewall ports

Run PowerShell as Administrator:

~~~powershell
New-NetFirewallRule -DisplayName "InvMS Frontend 8080" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080
New-NetFirewallRule -DisplayName "InvMS Backend 8000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000
~~~

Now another device on your Wi-Fi can open:
- http://YOUR_LAPTOP_IP:8080

---

## 7. Optional internet access (outside your home network)

If you want your client outside your Wi-Fi to test:
1. Configure router port forwarding:
- external 8080 -> laptop 8080
- external 8000 -> laptop 8000
2. Use your public IP.
3. If public IP changes often, use a DDNS service.

Security warning:
- Do this only for short testing windows.
- Close forwarded ports when not in use.

---

## 8. Optional Path B: use Dokploy on your laptop (advanced beginner)

Dokploy is Linux-first, so run it in WSL Ubuntu.

## 8.1 Open Ubuntu (WSL)

From PowerShell:

~~~powershell
wsl
~~~

## 8.2 Install Docker inside WSL (if needed)

If Docker Desktop WSL integration works, Docker command should already work in Ubuntu.

Test:

~~~bash
docker --version
docker compose version
~~~

## 8.3 Install Dokploy in WSL Ubuntu

~~~bash
curl -sSL https://dokploy.com/install.sh | sh
~~~

Then open Dokploy panel in browser on Windows:
- http://localhost:3000

From there, create project and deploy the same docker-compose setup.

If this feels complex, keep using Path A until you are comfortable.

---

## 9. Troubleshooting

1. Frontend opens but login fails with CORS
- Check CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS values.
- Rebuild/restart containers.

2. Backend cannot connect to DB
- Ensure POSTGRES_HOST=db (not localhost).
- Check db container is healthy.

3. Images/static missing
- Ensure collectstatic command runs in backend startup.

4. App works on localhost but not from other devices
- Check Windows firewall rules.
- Check you used laptop LAN IP, not 127.0.0.1.

5. Port already in use
- Change exposed ports in docker-compose.yml (for example 8081:80).

---

## 10. Daily commands you will use

Start services:

~~~powershell
docker compose up -d
~~~

Stop services:

~~~powershell
docker compose down
~~~

Rebuild after code/config changes:

~~~powershell
docker compose up -d --build
~~~

See running containers:

~~~powershell
docker compose ps
~~~

---

## 11. What to do next after learning

After successful laptop testing, move to a real Linux VPS and reuse the same Docker files.
That will give you better uptime and safer client access.

You are now set up for real deployment learning end-to-end.
