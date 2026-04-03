# Recovery Guide: PC Restart or Wi-Fi Change

Use this guide when your PC restarts, Docker Desktop stops, or your Wi-Fi changes and the app stops working on another device.

## 1. If your PC restarts

### What usually happens
- Docker Desktop may start again automatically, but not always.
- Your Dokploy containers or local Docker Compose containers may still be running.
- If they are not running, the app will not open in the browser.

### What to do first
1. Open Docker Desktop and wait until it says it is running.
2. Open PowerShell in the project folder:

```powershell
cd "E:\Projects\Office\Inventory Management System"
```

3. Check containers:

```powershell
docker ps
```

4. If you are using the local Compose stack, start it:

```powershell
docker compose up -d
```

5. Check status:

```powershell
docker compose ps
```

6. Open the app:
- Frontend on this PC: http://localhost:8080
- Backend on this PC: http://localhost:8000
- Dokploy panel: http://localhost:3000

### If the app still does not open
Run logs for the service that looks broken:

```powershell
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

If a port conflict appears, another container or app is already using that port.

## 2. If your Wi-Fi changes

### What changes
Your PC can get a new local IP address after reconnecting to Wi-Fi.
That matters when you open the app from a different device on the same network.

### Find the new IP
Run:

```powershell
ipconfig
```

Look for the IPv4 address of your active Wi-Fi adapter.

Example:
- Old IP: 192.168.1.23
- New IP: 192.168.1.2

### If you only use the app on this PC
You can keep using:
- http://localhost:8080
- http://localhost:8000

You do not need to change anything if you are only using the same PC.

### If you want to open it on another device on the same Wi-Fi
Use the new IPv4 address from `ipconfig`.

Examples:
- Frontend: http://192.168.1.2:8080
- Backend: http://192.168.1.2:8000

### Update the app settings
If your backend uses environment variables, update these values in `.env`:

- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`

Use both localhost and the new Wi-Fi IP.

Example:

```env
ALLOWED_HOSTS=127.0.0.1,localhost,192.168.1.2
CORS_ALLOWED_ORIGINS=http://127.0.0.1:8080,http://localhost:8080,http://192.168.1.2:8080
CSRF_TRUSTED_ORIGINS=http://127.0.0.1:8080,http://localhost:8080,http://192.168.1.2:8080
```

### After updating `.env`
Recreate the containers so they pick up the new settings:

```powershell
docker compose up -d --force-recreate
```

If Dokploy is managing the stack, update the environment values in the Dokploy project and redeploy from the dashboard.

## 3. Quick recovery checklist

### After a restart
- Open Docker Desktop
- Run `docker ps`
- Start the stack if needed
- Open http://localhost:8080

### After a Wi-Fi change
- Run `ipconfig`
- Note the new IPv4 address
- Update `.env` if you use another device
- Recreate or redeploy the containers

## 4. Common problems

### Error: Cannot connect to server. Is Django running?
Possible causes:
- Backend container is stopped
- Frontend is pointing to the wrong API URL
- CORS settings do not include the current origin

Fix:
- Check `docker compose ps`
- Check backend logs
- Update `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`

### App works on localhost but not on phone or another laptop
Possible causes:
- Wrong PC IP address
- Windows Firewall blocking ports 8080 or 8000
- CORS settings still use the old IP

Fix:
- Use the current IPv4 from `ipconfig`
- Allow ports 8080 and 8000 in Windows Firewall
- Recreate or redeploy the containers

### Port already in use
Possible causes:
- Another container is already running on 8080 or 8000
- Dokploy stack and local Compose stack are both running

Fix:
- Stop the duplicate stack
- Keep only one app stack using those ports

## 5. Safe rule to remember

If the PC restarted, check Docker first.
If the Wi-Fi changed, check the PC IP first.
If another device cannot connect, update the allowed origins and redeploy.



MinIO console:

URL: http://localhost:9001
User: minioadmin
Password: minioadmin123


How you can verify in app now:

Add or edit a product image.
Open product list/API response and check image URL starts with:
http://127.0.0.1:9000/invms-media/products/...

Current status:

Backend is running on 8000
Frontend is running on 8080
MinIO is running on 9000/9001
New product image uploads will now go to MinIO bucket invms-media