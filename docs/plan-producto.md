# Plan de producto: plataforma de planificación y seguimiento de entrenamiento

Documento de trabajo. Objetivo: convertir la planilla de microciclos en un producto donde el entrenador arma rutinas desde una biblioteca de ejercicios y el atleta las ejecuta y registra desde el teléfono.

## 1. Punto de partida: qué hace hoy la planilla

Estructura observada en "Microciclo 7: Introductorio":

- Un microciclo (semana) con nombre y objetivo ("pasar paulatinamente de alta intensidad a alto volumen").
- Cuatro días, cada uno con un foco (Squat/Row, Bench press/RDL, DL/Push, Pull/Squat) y una fecha.
- Por día, un check-in de regeneración con seis ítems en escala 1 a 7: tiempo de sueño, calidad del sueño, sensación de descanso, dolor, estrés y alimentación. Se suma un total y se muestra una recomendación ("Estado óptimo: ejecutar la sesión según lo planificado"). A menor puntaje, mejor estado (lógica tipo índice de Hooper).
- RPE de la sesión y volumen total del día.
- Bloques en orden fijo, cada uno con color por día: Construcción de movimiento, Calentamiento, Pliometría (o Potencia, o Velocidad), Primario, Secundario y Variabilidad. Cada bloque calcula su volumen.
- Cada ejercicio tiene nombre con link a video, una nota (3" de pausa, 12,5 x mano, 2 mancuernas de 20), repeticiones, series, kg y RPE.
- Comentarios libres por día.

Problemas de la planilla que el producto tiene que resolver, no solo replicar:

1. Mezcla lo prescrito con lo realizado. No se sabe si los 130 kg eran la meta o lo que se levantó.
2. Registra por ejercicio y no por serie. Si la segunda serie salió con menos repeticiones, se pierde el dato.
3. Fórmulas rotas (#REF! en el día 3) y etiquetas copiadas mal (el total del bloque secundario del día 1 dice "Bloque primario").
4. El volumen se calcula como reps por series por kg, lo que da 0 en ejercicios con peso corporal, banda o tiempo (Depth jump, Pull up, Plank 30"). El día 4 muestra 45 de volumen primario, que no dice nada útil.
5. Las repeticiones no siempre son números: "30" x mano", "2,5", tempos.
6. Las semanas anteriores viven en otras pestañas, así que ver la evolución exige armar gráficos a mano.

## 2. Usuarios

| Rol | Dispositivo principal | Qué necesita |
|---|---|---|
| Entrenador | Computador | Biblioteca de ejercicios, construir semanas y mesociclos rápido, asignar a atletas, ver quién entrenó, cómo llegó y cómo respondió |
| Atleta o paciente | Teléfono | Ver la sesión de hoy, ver el video de cada ejercicio, registrar series con kg y RPE, hacer el check-in, ver su progreso |
| Administrador (fase comercial) | Computador | Gestionar entrenadores, planes y cobro |

Recomendación: diseñar desde el día uno con organizaciones (multi-tenant), aunque al inicio el único cliente seas tú. Agregar una columna `org_id` hoy cuesta poco; agregarla después de tener datos cuesta una migración completa.

## 3. Alcance funcional

### 3.1 Biblioteca de ejercicios

- Ficha: nombre, video, miniatura, instrucciones cortas, patrón de movimiento (sentadilla, bisagra, empuje horizontal, empuje vertical, tracción horizontal, tracción vertical, core, locomoción, movilidad), equipamiento, músculos principales, lateralidad (bilateral o unilateral) y tipo de carga.
- Tipo de carga define qué se registra: carga externa (kg), peso corporal (reps, lastre opcional), banda (color o tensión), tiempo (segundos), distancia (metros), contactos (pliometría).
- Video: link de YouTube (se embebe con youtube-nocookie) o archivo propio subido al mismo servidor. Ambos se ven dentro de la app, sin salir a YouTube.
- Biblioteca global (la tuya) más ejercicios propios de cada organización.
- Búsqueda por texto y filtros por patrón, equipamiento y bloque sugerido.
- Carga inicial en dos fuentes: los ejercicios de la planilla actual con sus links (ver sección 9) y el dataset abierto exercises-dataset como catálogo base (ver sección 3.1.1).

#### 3.1.1 Dataset base: hasaneyldrm/exercises-dataset

Revisado el 28 de septiembre de 2026 (https://github.com/hasaneyldrm/exercises-dataset).

Qué trae: 1.324 ejercicios en un JSON con id, nombre, categoría, parte del cuerpo, equipamiento, músculo objetivo, músculos secundarios e instrucciones paso a paso en 10 idiomas, incluido español. Cada registro apunta a un GIF animado y una miniatura de 180 x 180.

Licencia, que es lo que define cómo usarlo:

- Datos (nombres, categorías, equipamiento, músculos, instrucciones y traducciones): MIT. Se pueden copiar, modificar y usar en un producto comercial manteniendo el aviso de copyright en el repo.
- GIFs y miniaturas: no son MIT. Son propiedad de Gym visual y el autor los redistribuye con un permiso escrito propio. El LICENSE dice expresamente que clonar el repo no entrega licencia sobre los medios y que cada uno debe obtener la suya con Gym visual. Para un producto que se va a vender, no se deben servir esos GIFs sin comprar esa licencia.

Cobertura contra lo que usas: está orientado a gimnasio y musculación (325 con peso corporal, 294 con mancuernas, 157 en polea, 154 con barra). Tiene bien cubiertos los ejercicios de los bloques Primario, Secundario y Variabilidad (Arnold press, curl, extensión de rodilla, remo, press). Cubre poco lo de Construcción de movimiento, Pliometría y readaptación: no aparecen hip thrust con barra, depth jump, bird dog, nórdico ni Copenhagen, y "step up" solo existe como variante combinada. Tampoco trae patrón de movimiento, tipo de carga ni bloque sugerido, que son los campos que usa el constructor.

Cómo usarlo:

1. Importar solo los datos (MIT) como biblioteca global, marcada con `origen = exercises-dataset` y el id original para poder actualizar después.
2. Enriquecer cada registro con patrón de movimiento, tipo de carga y bloque sugerido. Se puede hacer en lote con Claude a partir de nombre, equipamiento y músculo objetivo, con revisión manual por muestreo.
3. Adaptar las instrucciones en español a español de Chile (vienen en español de España: "túmbate") y traducir los nombres, que vienen solo en inglés. Conviene guardar nombre en inglés y en español, porque en el gimnasio se usan ambos (BB bench press, sentadilla búlgara).
4. Video: para los ejercicios del dataset, quedan sin medio hasta que se decida (a) comprar la licencia de Gym visual, (b) grabar videos propios de los ejercicios que realmente usas o (c) enlazar videos de YouTube. Para tus ejercicios, siguen mandando los links de la planilla.
5. Tus ejercicios de la planilla se crean como ejercicios propios y, cuando coinciden con uno del dataset, se enlazan para heredar músculos e instrucciones.

En resumen: sirve como catálogo inicial y ahorra semanas de carga de datos, pero no reemplaza tu biblioteca ni resuelve el tema de los videos.

### 3.2 Estructura de periodización

Jerarquía:

```
Programa (plantilla o asignado a un atleta)
  Mesociclo (3 a 6 semanas, con un objetivo)
    Microciclo (semana)
      Sesión (día)
        Bloque (Construcción de movimiento, Calentamiento, Primario...)
          Ejercicio prescrito (series, reps, carga, RPE objetivo, notas)
```

Tipos de mesociclo configurables, con valores por defecto que el entrenador puede cambiar:

| Tipo | Series | Reps | RPE objetivo | Uso |
|---|---|---|---|---|
| Introductorio o adaptación | 2 a 3 | 10 a 15 | 6 a 7 | Inicio, retorno después de pausa |
| Hipertrofia | 3 a 4 | 8 a 12 | 7 a 9 | Acumulación de volumen |
| Fuerza | 3 a 5 | 3 a 6 | 8 a 9 | Intensificación |
| Potencia | 3 a 5 | 1 a 5 | 6 a 8 | Velocidad de ejecución, pliometría |
| Descarga | 2 | igual o menos | 5 a 6 | Recuperación |
| Readaptación o terapia | libre | libre | libre | Pacientes, dolor, control motor |

Los rangos son sugerencias al crear, no reglas. El tipo de mesociclo también define la plantilla de bloques por defecto (por ejemplo, Potencia agrega Pliometría y Velocidad).

### 3.3 Constructor del entrenador

La vista principal replica lo que ya funciona en la planilla: días como columnas, bloques como secciones apiladas, colores por día.

- Panel lateral con la biblioteca: buscar, filtrar y arrastrar un ejercicio a un bloque de cualquier día. Alternativa sin arrastre: botón "+" en el bloque que abre el buscador (necesario para tablet y para accesibilidad).
- Edición en línea de series, reps, carga y RPE, con tabulador para saltar de celda como en una planilla.
- Carga prescrita de tres formas: kg fijos, porcentaje de 1RM (se calcula con el último 1RM estimado del atleta) o solo RPE objetivo.
- Superseries y circuitos: agrupar ejercicios dentro de un bloque (A1, A2).
- Acciones rápidas: duplicar día, duplicar semana, copiar bloque a otro día, reordenar arrastrando.
- Progresión automática al duplicar una semana: sumar kg, sumar reps, sumar series o subir RPE objetivo, por ejercicio o por bloque. Así se arma un mesociclo de 4 semanas en minutos.
- Guardar como plantilla (sesión, semana o mesociclo) y asignarla a uno o varios atletas con fecha de inicio.
- Vista calendario mensual para ver el mesociclo completo y mover sesiones de día.

### 3.4 App del atleta (teléfono)

1. Pantalla Hoy: la sesión del día, o la próxima si hoy es descanso.
2. Check-in de regeneración antes de empezar: los seis ítems con botones 1 a 7 grandes, total automático y la recomendación. Si el total supera un umbral, se avisa al entrenador.
3. Sesión por bloques. Cada ejercicio muestra video (toque para reproducir en la misma pantalla), la nota del entrenador y la prescripción.
4. Registro por serie: reps, kg y RPE, prellenados con lo prescrito para que en el caso normal sea solo marcar la serie como hecha. Temporizador de descanso opcional.
5. Al cerrar: RPE de la sesión, duración (se calcula sola), comentario libre.
6. Historial por ejercicio al tocarlo: qué hizo la última vez y su mejor marca.
7. Funciona sin señal: el gimnasio es el peor lugar para depender de conexión. Los registros se guardan en el teléfono y se sincronizan al volver la red.

### 3.5 Progreso y evolución

Para el atleta:

- Por ejercicio: carga máxima, 1RM estimado y volumen en el tiempo.
- Por semana: volumen por bloque y por patrón de movimiento, adherencia (sesiones hechas sobre planificadas).
- Tendencia del check-in de regeneración.

Para el entrenador:

- Tablero con todos los atletas: quién entrenó, quién no, check-ins en rojo, RPE registrado muy sobre el objetivo.
- Carga interna semanal por atleta (RPE de sesión por minutos) y su relación con la regeneración.
- Comparación prescrito contra realizado por ejercicio, para ajustar la semana siguiente.

## 4. Cálculos

| Métrica | Fórmula | Nota |
|---|---|---|
| Tonelaje | suma de reps por kg de cada serie registrada | Solo ejercicios con carga externa |
| Reps totales | suma de reps | Para peso corporal y banda |
| Contactos | suma de reps en ejercicios pliométricos | Métrica estándar de pliometría |
| Tiempo bajo trabajo | suma de segundos | Isométricos, planchas |
| 1RM estimado | kg por (1 + (reps + (10 menos RPE)) / 30) | Epley ajustado por repeticiones en reserva; sin RPE se usa Epley simple |
| Carga interna de sesión | RPE de sesión por minutos | Método de Foster |
| Regeneración | suma de los seis ítems (6 a 42) | Umbrales configurables por entrenador |

Separar las métricas por tipo de carga corrige el problema del volumen en 0 o sin sentido de la planilla. Cada bloque muestra las métricas que le aplican.

Umbrales de regeneración: en la planilla, total 8 y 9 dan "Estado óptimo" y total 11 y 17 dan "Buen estado". Falta confirmar los cortes exactos de la fórmula actual y qué pasa sobre el último umbral.

## 5. Modelo de datos (primera versión)

```
organizations        id, nombre, plan
users                id, org_id, rol (owner, coach, athlete), nombre, email, peso_corporal
coach_athletes       coach_id, athlete_id

exercises            id, org_id (null = global), origen, origen_id, nombre, nombre_en,
                     video_url, video_provider,
                     thumbnail_url, patron, equipamiento[], musculos[], lateralidad,
                     tipo_carga, instrucciones, tags[]
block_types          id, org_id, nombre, orden_default, color, metricas[]

programs             id, org_id, coach_id, athlete_id (null = plantilla), nombre, inicio
mesocycles           id, program_id, orden, nombre, tipo, semanas, objetivo
microcycles          id, mesocycle_id, orden, nombre, objetivo
sessions             id, microcycle_id, dia, nombre, fecha_programada, color
session_blocks       id, session_id, block_type_id, orden, titulo_override
prescriptions        id, block_id, exercise_id, orden, grupo (superserie), series,
                     reps_texto, reps_min, reps_max, carga_kg, carga_pct_1rm,
                     rpe_objetivo, tempo, descanso_s, nota

wellness_checkins    id, athlete_id, session_id, fecha, sueno_tiempo, sueno_calidad,
                     descanso, dolor, estres, alimentacion, total
workout_logs         id, session_id, athlete_id, inicio, fin, rpe_sesion, comentario
set_logs             id, workout_log_id, prescription_id, n_serie, reps, carga_kg,
                     segundos, rpe, completada
```

Decisiones de diseño:

- Prescripción y registro en tablas distintas (`prescriptions` contra `set_logs`). Es el cambio más importante respecto de la planilla.
- `reps_texto` guarda lo que el entrenador escribe ("30" x mano", "8 a 10") y `reps_min`/`reps_max` la versión numérica para cálculos.
- Al asignar una plantilla a un atleta se copia la estructura. Editar la plantilla después no cambia programas ya asignados, salvo que el entrenador lo pida.
- `wellness_checkins` va ligado a la sesión pero puede existir sin ella (check-in diario en días de descanso).

## 6. Arquitectura y stack (decidido el 28 de septiembre de 2026)

Todo queda en Docker en un VPS de Hostinger, sin servicios externos.

| Capa | Decisión | Por qué |
|---|---|---|
| Aplicación | Next.js 16 (App Router, server actions) con TypeScript, una sola app con dos superficies: `/coach` y `/atleta` | Un repo, un despliegue, código compartido |
| App móvil | PWA instalable (agregar a pantalla de inicio) | Sin tiendas de apps; video y registro sin señal funcionan en iOS y Android |
| Base de datos | PostgreSQL 17 en un contenedor del mismo servidor | Sin dependencia de terceros |
| ORM | Prisma 7 con adaptador pg | Migraciones versionadas y tipos generados |
| Autenticación | NextAuth v4 con email y contraseña, sesión JWT | El entrenador invita al atleta con un link que envía por WhatsApp; no hace falta servidor de correo |
| Interfaz | shadcn/ui (Radix) y Tailwind CSS 4 | Componentes accesibles y consistentes |
| Arrastrar y soltar | dnd-kit | Soporta mouse, teclado y táctil |
| Registro sin señal | Cola local en el teléfono (localStorage) y service worker para abrir pantallas ya visitadas | El gimnasio es el peor lugar para depender de conexión |
| Gráficos | Recharts (vía shadcn charts) | Series de tiempo y barras apiladas |
| Video propio | Archivos subidos a un volumen Docker, servidos con soporte de Range | Sin servicio de streaming externo; YouTube sigue disponible para links existentes |
| HTTPS | Caddy con certificado automático de Let's Encrypt | Un contenedor más, sin configuración manual |
| Respaldos | pg_dump diario en el mismo compose, 14 días | Copia fuera del servidor a cargo del administrador |

Guía de instalación: [despliegue.md](despliegue.md).

Si más adelante se necesita presencia en App Store y Google Play, se envuelve la PWA o se construye una app con Expo reutilizando la API. No conviene partir por ahí.

Datos de salud: si hay pacientes (dolor, lesiones, readaptación), la Ley 21.719 los trata como datos sensibles. Hay que pedir consentimiento explícito al crear la cuenta, restringir el acceso por fila (cada entrenador ve solo a sus atletas) y permitir exportar y borrar los datos de un atleta.

## 7. Pantallas

Entrenador:

1. Atletas: lista con estado de la semana (sesiones hechas, último check-in, alertas).
2. Ficha de atleta: programa actual, calendario, progreso, historial de check-ins.
3. Constructor semanal: columnas por día, bloques, panel de biblioteca a la derecha.
4. Calendario del mesociclo: vista de 4 a 6 semanas con resumen de volumen por semana.
5. Plantillas: sesiones, semanas y mesociclos guardados.
6. Biblioteca: ficha de ejercicio con video, filtros, alta y edición.
7. Configuración: tipos de bloque, colores, umbrales de regeneración, tipos de mesociclo.

Atleta:

1. Hoy.
2. Check-in.
3. Sesión en curso (bloques, video, registro por serie, descanso).
4. Cierre de sesión.
5. Calendario (semana y mes).
6. Progreso.
7. Detalle de ejercicio (video, historial, mejor marca).

## 8. Roadmap

### Fase 0: preparación (1 semana)

- Cerrar las decisiones de la sección 10.
- Wireframes del constructor y de la sesión en el teléfono.
- Script de importación de la planilla: biblioteca de ejercicios con links y, si se puede, el historial de los microciclos 1 a 7.

### Estado al 28 de septiembre de 2026

Construido y probado en local: todo el alcance de la Fase 1 y buena parte de la Fase 2 (mesociclos con tipo, plantillas y asignación, progresión automática al duplicar semanas, carga por % de 1RM, tablero con alertas, registro sin señal, subida de videos propios). Los 46 ejercicios de la planilla quedan cargados sin link de video; los links se agregan desde la biblioteca o con el importador de la planilla, que queda pendiente hasta tener el .xlsx. Pendiente de la Fase 2: vista calendario mensual del mesociclo para el entrenador y notificaciones push.

### Fase 1: MVP de uso propio (5 a 7 semanas)

Meta: dejar de usar la planilla.

- Autenticación, roles entrenador y atleta.
- Biblioteca con video embebido.
- Constructor semanal con arrastrar y soltar, edición en línea y duplicar día o semana.
- Asignación de semana a atleta.
- App del atleta: Hoy, check-in, sesión con video, registro por serie, cierre con RPE y comentario.
- Progreso básico: 1RM estimado y carga máxima por ejercicio, volumen semanal, tendencia de regeneración.

### Fase 2: periodización y seguimiento (4 a 6 semanas)

- Mesociclos con tipo y objetivo, vista calendario, plantillas.
- Progresión automática al duplicar semanas y carga por porcentaje de 1RM.
- Tablero del entrenador con alertas.
- Modo offline completo y notificaciones push.
- Subida de videos propios.

### Fase 3: producto comercial (a definir)

- Varios entrenadores por organización, invitación de atletas por link.
- Cobro por suscripción (Flow o Mercado Pago para Chile).
- Marca propia por organización (logo, colores).
- Recordatorios por WhatsApp.
- Servidor MCP remoto con OAuth 2.1 en el backend, para que el entrenador pueda pedirle a Claude cosas como "arma un mesociclo de hipertrofia de 4 semanas para Juan basado en su último microciclo" o "qué atletas llegaron con mala regeneración esta semana". Pegar la URL en Claude, aceptar en la pantalla de consentimiento con el login del producto, listo.

Las semanas son estimaciones para una persona trabajando con Claude Code, a ajustar después de la Fase 0.

## 9. Migración desde la planilla

1. Exportar la planilla de Google Sheets como .xlsx y dejarla en `data/`.
2. Script en Python con openpyxl que lea cada pestaña de microciclo, extraiga el nombre y el hipervínculo de cada ejercicio y deduplique la biblioteca (hay variantes del mismo ejercicio escritas distinto, como "BB BENCH PRES (3' DE PAUSA)").
3. Revisión manual de la biblioteca resultante: unificar nombres, asignar patrón, tipo de carga y bloque sugerido.
4. Opcional: importar los microciclos anteriores como historial, marcando que los kg y RPE pueden ser prescritos o realizados sin distinción, para que el gráfico de progreso no parta en cero.

## 10. Decisiones pendientes

1. Alcance comercial: ¿el producto es para tus atletas o pacientes, o para venderlo a otros entrenadores y kinesiólogos? El diseño multi-tenant sirve para ambos, pero cambia la prioridad de la Fase 3.
2. Usuarios finales: ¿atletas de rendimiento, pacientes en terapia o ambos? Si hay pacientes, sube la prioridad del consentimiento y del bloque de readaptación.
3. Umbrales de regeneración: quedaron configurables en Configuración con cortes provisorios (hasta 10 óptimo, hasta 20 bueno, hasta 28 regular, sobre 28 deficiente), coherentes con los ejemplos de la planilla. Falta confirmarlos con la fórmula original.
4. Quién llena qué: implementado como el entrenador prescribe y el atleta registra cada serie (prellenada con lo prescrito).
5. Videos: ¿están todos en YouTube (propios o de terceros) o hay que subir videos propios desde el MVP? Y para el catálogo de exercises-dataset: ¿cotizar la licencia de Gym visual, grabar videos propios o dejarlos sin video?
6. Stack: decidido (sección 6).
7. Nombre del producto y dominio.
