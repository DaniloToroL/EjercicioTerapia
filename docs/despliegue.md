# Despliegue en VPS Hostinger

Todo corre en Docker en el mismo servidor: PostgreSQL, migraciones, la app, Caddy para HTTPS y un respaldo diario de la base. No hay servicios externos salvo Let's Encrypt para el certificado.

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

Completar `APP_DOMAIN`, `NEXTAUTH_URL` (con https), `NEXTAUTH_SECRET` y `POSTGRES_PASSWORD`. Para generar los secretos:

```bash
openssl rand -base64 32
```

```bash
openssl rand -hex 24
```

La clave de Postgres debe tener solo letras y números (va dentro de una URL de conexión).

4. Levantar todo:

```bash
docker compose up -d --build
```

El servicio `migrate` aplica las migraciones y carga la biblioteca base (46 ejercicios de la planilla y 1.324 del catálogo) y termina. Después arranca la app y Caddy obtiene el certificado HTTPS.

5. Abrir `https://APP_DOMAIN`. La primera vez aparece la configuración inicial para crear el centro y la cuenta dueña.

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
| `caddy_data` | Certificados HTTPS |
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
