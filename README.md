# Entrenamiento

Plataforma para planificar entrenamiento por mesociclos y microciclos y hacer seguimiento desde el teléfono. Reemplaza la planilla de microciclos: el entrenador arma las semanas arrastrando ejercicios desde una biblioteca y el atleta ve su sesión, el video de cada ejercicio, registra series con kg y RPE, hace el check-in de regeneración y ve su progreso.

Cada atleta tiene un link personal (`/r/<token>`) para copiar y pegar. El entrenador decide en la ficha del atleta si el link es con login (crea su contraseña la primera vez y después ingresa con ella) o abierto (entra directo, sin contraseña ni email). Generar un link nuevo invalida el anterior y cierra las sesiones abiertas con él.

El superadmin (definido con `SUPERADMIN_EMAIL` en el `.env`) administra toda la plataforma desde `/admin`: crea centros con su dueño, agrega entrenadores, suspende centros y puede entrar a cualquiera con permisos de dueño. La biblioteca global (ejercicios de la planilla con sus 147 videos y el catálogo base) solo la edita el superadmin; cada centro edita sus propios ejercicios.

Plan de producto y decisiones: [docs/plan-producto.md](docs/plan-producto.md). Despliegue en el VPS: [docs/despliegue.md](docs/despliegue.md).

## Stack

- Next.js 16 (App Router, server actions) con TypeScript
- PostgreSQL 17 en Docker, Prisma 7 como ORM (adaptador `pg`)
- NextAuth v4 con email y contraseña (JWT), sin servicios externos
- shadcn/ui (Radix) y Tailwind CSS 4
- dnd-kit para arrastrar y soltar, Recharts para gráficos
- PWA instalable con cola local para registrar series sin señal
- Docker Compose: base de datos, migraciones, app y respaldo diario; nginx del VPS como proxy HTTPS (sitio en `deploy/nginx`)

## Estructura

```
prisma/
  schema.prisma          modelo de datos (programa > mesociclo > microciclo > sesión > bloque > ejercicio)
  migrations/            migraciones SQL
  seed.ts                importa la biblioteca base; con SEED_DEMO=true crea datos de demostración
  seed/catalog.ts        ejercicios de la planilla y catálogo exercises-dataset (solo datos MIT)
  seed/demo.ts           réplica del Microciclo 7 con tres semanas registradas
  data/                  extracto del dataset y su licencia
src/
  actions/               server actions (atletas, ejercicios, programas, registros, configuración)
  app/coach/             panel del entrenador: atletas, programas (constructor), biblioteca, configuración
  app/atleta/            app del atleta: hoy, sesión, calendario, progreso
  app/api/               NextAuth, subida y streaming de videos
  components/builder/    constructor con arrastrar y soltar
  components/athlete/    ejecución de la sesión, check-in, temporizador
  lib/                   auth, consultas, métricas (1RM, volumen, carga interna), fechas, cola offline
```

## Desarrollo local

Requisitos: Node 22 y Docker (o un PostgreSQL propio).

```bash
npm install
docker compose -f docker-compose.dev.yml up -d
```

Crear `.env` en la raíz:

```
DATABASE_URL="postgresql://entrenamiento:entrenamiento@localhost:5432/entrenamiento?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="cualquier-texto-largo-para-desarrollo"
UPLOAD_DIR="./uploads"
```

Migrar, cargar datos y levantar:

```bash
npx prisma migrate dev
SEED_DEMO=true npx prisma db seed
npm run dev
```

Con `SEED_DEMO=true` se crean una cuenta de entrenador y una de atleta de prueba; los emails y la contraseña están al inicio de `prisma/seed/demo.ts`. Sin datos de demostración, al abrir http://localhost:3000 aparece la configuración inicial para crear el centro y la cuenta dueña.

Comandos útiles:

```bash
npm run typecheck
npm run lint
npm run db:studio
```

## Cálculos

- Tonelaje: reps por kg de las series realizadas, solo ejercicios con carga externa o lastre. Peso corporal, banda, tiempo y pliometría se miden en reps, segundos y contactos.
- 1RM estimado: Epley ajustado por repeticiones en reserva, kg por (1 + (reps + (10 menos RPE)) / 30). Se descartan series de más de 12 reps.
- Carga interna: RPE de la sesión por minutos (Foster).
- Regeneración: suma de seis ítems de 1 a 7 (6 a 42, menor es mejor). Los tramos y mensajes se configuran en Configuración.

## Licencias de terceros

`prisma/data/exercises-dataset.json` es un extracto de [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) bajo licencia MIT (ver `prisma/data/EXERCISES-DATASET-LICENSE.txt`). No incluye las imágenes ni los GIF, que son de Gym visual y requieren licencia propia.
