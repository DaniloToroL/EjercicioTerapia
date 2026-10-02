# Despliegue en VPS Hostinger

Todo corre en Docker en el mismo servidor: PostgreSQL, migraciones, la app y un respaldo diario de la base. El nginx que ya tiene el VPS hace de proxy con HTTPS (certificado de Let's Encrypt con certbot). La app solo escucha en 127.0.0.1, así que no queda expuesta directamente.

## Requisitos

- VPS con Ubuntu 22.04 o 24.04 (plantilla "Ubuntu with Docker" de Hostinger, o Docker instalado a mano). Con 2 GB de RAM alcanza; la compilación de la imagen es el momento de mayor consumo.
- Un dominio o subdominio con un registro DNS tipo A apuntando a la IP del VPS (por ejemplo `entrenamiento.tudominio.cl`).
- Puertos 80 y 443 abiertos en el firewall del panel de Hostinger y en `ufw` si está activo.

## Instalación

1. Instalar Docker si la plantilla no lo trae:

```bash
curl -fsSL https://get.docker.com | sh
```

2. Copiar el proyecto al servidor (git clone o scp) y entrar a la carpeta.

3. Crear el archivo de configuración:

```bash
cp .env.example .env
nano .env
```

Completar `NEXTAUTH_URL` (con https y el dominio real), `APP_PORT` (4060 por defecto, dentro del rango 4060 a 4069) si ya está ocupado, `NEXTAUTH_SECRET` y `POSTGRES_PASSWORD`. Para generar los secretos:

```bash
openssl rand -base64 32
```

```bash
openssl rand -hex 24
```

La clave de Postgres debe tener solo letras y números (va dentro de una URL de conexión).

Para el superadmin, poner `SUPERADMIN_EMAIL`. Si esa cuenta ya existe (por ejemplo, el dueño creado en `/setup`), en el próximo arranque queda marcada como superadmin sin tocar su contraseña. Si no existe, se crea con `SUPERADMIN_PASSWORD`, que después se puede borrar del `.env`. El panel queda en `/admin` y aparece como "Superadmin" en el menú.

4. Levantar todo:

```bash
docker compose up -d --build
```

El servicio `migrate` aplica las migraciones y carga la biblioteca base (46 ejercicios de la planilla y 1.324 del catálogo) y termina. Después arranca la app en `127.0.0.1:APP_PORT`. Para comprobar que responde (cambiar 4060 si se usó otro puerto):

```bash
curl -I http://127.0.0.1:4060/login
```

5. Configurar nginx. Copiar el sitio incluido en el repositorio y editar `server_name` con el dominio real (y el puerto de `proxy_pass` si se cambió `APP_PORT`):

```bash
sudo cp deploy/nginx/ejercicio-terapia /etc/nginx/sites-available/ejercicio-terapia
```

```bash
sudo nano /etc/nginx/sites-available/ejercicio-terapia
```

Activarlo, validar y recargar:

```bash
sudo ln -s /etc/nginx/sites-available/ejercicio-terapia /etc/nginx/sites-enabled/ejercicio-terapia
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

6. Obtener el certificado HTTPS. Certbot agrega el bloque 443 al mismo archivo y la redirección desde http:

```bash
sudo certbot --nginx -d entrenamiento.tudominio.cl
```

Si certbot no está instalado:

```bash
sudo apt install certbot python3-certbot-nginx
```

7. Abrir `https://` con el dominio configurado. La primera vez aparece la configuración inicial para crear el centro y la cuenta dueña.

## Operación

Ver estado y logs:

```bash
docker compose ps
```

```bash
docker compose logs -f app
```

Actualizar a una versión nueva del código:

```bash
git pull
```

```bash
docker compose up -d --build
```

Las migraciones nuevas se aplican solas en cada arranque.

## Datos y respaldos

| Volumen o carpeta | Contenido |
|---|---|
| `pgdata` | Base de datos |
| `uploads` | Videos de ejercicios subidos desde la biblioteca |
| `/etc/letsencrypt` (del VPS) | Certificados HTTPS, renovados por certbot |
| `./backups` | Respaldo diario de la base (`pg_dump`, se guardan 14 días) |

Los respaldos quedan en el mismo servidor. Conviene copiarlos fuera de vez en cuando (por ejemplo, descargar la carpeta `backups` o activar los snapshots del VPS en Hostinger).

Restaurar un respaldo:

```bash
docker compose exec -T db pg_restore -U entrenamiento -d entrenamiento --clean --if-exists < backups/ARCHIVO.dump
```

Respaldar los videos subidos:

```bash
docker run --rm -v ejercicioterapia_uploads:/data -v $(pwd):/out alpine tar czf /out/uploads.tgz -C /data .
```

El nombre del volumen depende de la carpeta del proyecto; se confirma con `docker volume ls`.

## Instalación de prueba

Para mostrar la plataforma con datos, poner `SEED_DEMO=true` en `.env` antes del primer arranque, con la base vacía. Crea un entrenador y un atleta de prueba con el Microciclo 7 y tres semanas registradas. No usar en la instalación real.

## Cargar una semana de la planilla

Las semanas extraídas de la planilla DANILO quedan en `prisma/data/semana-AAAA-MM-DD.json`. Este comando carga la más reciente como programa de la cuenta indicada (puede ser la propia del entrenador, que la ve en "Mi entrenamiento"):

```bash
docker compose run --rm migrate npx tsx prisma/seed/semana.ts --email tu-email-de-la-cuenta
```

Los días que ya se hicieron en la planilla quedan registrados (series, RPE, regeneración y comentario) y los pendientes quedan planificados, con el RPE de la planilla como objetivo. Correrlo de nuevo no duplica nada; con `--reemplazar` borra esa carga y la vuelve a crear, incluidos los registros hechos en la app sobre ella. Para otra semana: `--archivo prisma/data/semana-AAAA-MM-DD.json`.
