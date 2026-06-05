# Sistema de Revisión de Tesis — Plataforma Inteligente (Thesis Review)

¡Bienvenido al **Sistema de Revisión de Tesis**! Esta es una plataforma web y móvil empresarial diseñada para automatizar y mejorar la calidad académica en la evaluación de proyectos y borradores de tesis de pregrado y posgrado. 

El sistema utiliza modelos de lenguaje (LLMs) a través de **Azure OpenAI** para estructurar, evaluar y validar formalmente los proyectos basándose en esquemas institucionales específicos (como `EsquemaPT.docx`), realizar verificaciones bibliográficas (normativa APA 7 via CrossRef), y detectar plagio y texto generado por Inteligencia Artificial (con Copyleaks y similitud vectorial de pgvector).

---

## 🏗️ Arquitectura del Proyecto

El proyecto está estructurado como un **monorepo** gestionado por **Turborepo**, garantizando una excelente modularidad, reutilización de tipos y flujos de trabajo eficientes.

```mermaid
graph TD
    subgraph Apps
        Web[apps/web<br>Next.js 15 + React 19]
        Mobile[apps/mobile<br>Expo Router + React Native]
        API[apps/api<br>NestJS API Gateway]
    end

    subgraph Shared Packages
        Shared[packages/shared<br>Common Types & DTOs]
        DB[packages/database<br>Prisma Schema & Migrations]
        AIEngine[packages/ai-engine<br>Parsing Mammoth/PDF + Langchain]
    end

    subgraph Infrastructure
        PG[PostgreSQL + pgvector]
        RD[Redis + BullMQ Queues]
        MIO[MinIO / S3 Storage]
        AzureOpenAI[Azure OpenAI Service]
        Copyleaks[Copyleaks API]
    end

    Web --> API
    Mobile --> API
    API --> Shared
    API --> DB
    API --> AIEngine
    AIEngine --> AzureOpenAI
    API --> PG
    API --> RD
    API --> MIO
    API --> Copyleaks
    Web --> Shared
    Mobile --> Shared
```

---

## 🛠️ Tecnologías y Dependencias

### Core & Backend (`apps/api`)
- **Framework:** [NestJS 11](https://nestjs.com/) (TypeScript)
- **Base de datos:** [Prisma ORM](https://www.prisma.io/) (PostgreSQL con extensión `pgvector`)
- **Procesamiento en segundo plano:** [BullMQ](https://docs.bullmq.io/) + [Redis](https://redis.io/)
- **Almacenamiento de archivos:** [MinIO](https://min.io/) (Compatible con Amazon S3)
- **Autenticación:** Passport.js + JWT (JSON Web Tokens) + Bcrypt para hashing de contraseñas
- **Documentación de API:** [Swagger / OpenAPI](https://swagger.io/)
- **Notificaciones:** Nodemailer (Email) + Expo Push Tokens (Notificaciones Push para dispositivos móviles)

### Frontend Web (`apps/web`)
- **Framework:** [Next.js 15](https://nextjs.org/) (App Router + React 19)
- **Estilos:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Gestión de Estado y Data Fetching:** [TanStack React Query v5](https://tanstack.com/query/latest)
- **Componentes & Iconos:** Lucide React + CSS Nativo + Sonner (toasts)
- **Visualización de Datos:** Chart.js + React Chartjs 2

### Cliente Móvil (`apps/mobile`)
- **Framework:** [Expo v54](https://expo.dev/) (React Native v0.76+ / React 19)
- **Enrutamiento:** Expo Router v3 (File-based routing)
- **Animaciones:** React Native Reanimated v4
- **Gestión de Interacciones:** React Native Gesture Handler + React Native Screens

### Paquetes Compartidos (`packages/`)
- `@thesis-review/database`: Definición de esquema Prisma centralizado y scripts de semillas (seeding).
- `@thesis-review/ai-engine`: Pipeline principal para extracción de texto (`mammoth` para `.docx` y `pdf-parse` para `.pdf`) y análisis por IA usando LangChain y esquemas estructurados de Zod.
- `@thesis-review/shared`: Interfaces de typescript, tipos de negocio y DTOs comunes.

---

## 📁 Estructura del Directorio

```text
thesis-review/
├── apps/
│   ├── api/                    # Servidor NestJS (Backend)
│   ├── web/                    # Aplicación Web Next.js (Frontend)
│   └── mobile/                 # Aplicación Móvil Expo (iOS & Android)
├── packages/
│   ├── ai-engine/              # Lógica de procesamiento y análisis con LLM
│   ├── database/               # Esquema de Prisma, migraciones y seeders
│   └── shared/                 # Modelos de datos y utilidades compartidas
├── docker-compose.yml          # Orquestador local (Postgres + pgvector, Redis, MinIO)
├── package.json                # Configuración de Turborepo y dependencias globales
├── turbo.json                  # Configuración de pipelines de Turborepo
└── README.md                   # Esta documentación
```

---

## ⚙️ Configuración del Entorno (`.env`)

Crea un archivo `.env` en la raíz del proyecto basándote en `.env.example`. Los siguientes valores son obligatorios para el correcto funcionamiento:

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `DATABASE_URL` | URL de conexión para PostgreSQL | `postgresql://thesis:supersecret123@localhost:5433/thesis_review` |
| `REDIS_HOST` | Host para la cola de BullMQ | `localhost` |
| `REDIS_PORT` | Puerto de la instancia Redis | `6379` |
| `MINIO_ACCESS_KEY` | Llave de acceso para almacenamiento MinIO | `minioadmin` |
| `MINIO_SECRET_KEY` | Llave secreta para almacenamiento MinIO | `minioadmin123` |
| `MINIO_BUCKET` | Nombre del contenedor/bucket de S3 | `thesis-documents` |
| `AZURE_OPENAI_API_KEY` | Credencial para el servicio de Azure OpenAI | *Obligatorio (Tu API Key)* |
| `AZURE_OPENAI_ENDPOINT` | URL base del endpoint de Azure OpenAI | `https://tu-recurso.openai.azure.com/` |
| `AZURE_OPENAI_DEPLOYMENT_NAME`| Nombre del despliegue del modelo (GPT-4o) | `gpt-4o` |
| `AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT` | Nombre del despliegue del modelo de embeddings | `text-embedding-3-large` |
| `JWT_SECRET` | Llave secreta para firmar tokens JWT | *Clave aleatoria de 256 bits* |
| `ORCID_CLIENT_ID` | Identificador de cliente para OAuth ORCID | *Opcional* |
| `ORCID_CLIENT_SECRET` | Llave secreta para OAuth ORCID | *Opcional* |
| `COPYLEAKS_EMAIL` | Correo de registro en Copyleaks | *Opcional (Usa Simulación si falta)* |
| `COPYLEAKS_API_KEY` | API Key de Copyleaks | *Opcional (Usa Simulación si falta)* |

---

## 🚀 Guía de Inicio Rápido

Sigue estos pasos para levantar el proyecto en tu entorno local:

### 1. Requisitos Previos
Asegúrate de tener instalado:
- **Node.js** (versión recomendada >= 20.x)
- **Docker** y **Docker Compose**
- **npm** (versión >= 10.x) o **npx**

### 2. Levantar la Infraestructura Local
Usa Docker Compose para levantar PostgreSQL con pgvector, Redis y MinIO:
```bash
docker compose up -d
```
> [!NOTE]
> El puerto mapeado para la base de datos de PostgreSQL es `5433` para evitar conflictos con instancias locales de Postgres ejecutándose en el puerto estándar `5432`.

### 3. Instalar Dependencias
Instala todas las dependencias del monorepo desde la raíz:
```bash
npm install
```

### 4. Ejecutar Migraciones y Poblar la Base de Datos (Seeding)
Aplica el esquema y ejecuta el seed para rellenar la base de datos con programas, plantillas académicas, rúbricas de evaluación y usuarios de prueba:
```bash
# Aplicar migraciones
npm run db:migrate

# Ejecutar el script seed
npm run db:seed
```

### 5. Iniciar en Modo Desarrollo
Para iniciar todos los servicios del monorepo (`api`, `web`, y `mobile`) simultáneamente con Turborepo, ejecuta:
```bash
npm run dev
```

Esto iniciará:
- **NestJS Backend API:** [http://localhost:3001](http://localhost:3001) (con Swagger accesible en `/api/docs`)
- **Next.js Web Frontend:** [http://localhost:3000](http://localhost:3000)
- **Expo Mobile Server:** CLI de Metro para lanzar el emulador Android/iOS.

---

## 👥 Credenciales de Prueba

La base de datos seeded viene con varios perfiles preestablecidos para probar los diferentes roles del sistema. Todos comparten la misma contraseña:

**Contraseña única:** `ThesisReview2025!`

| Rol | Correo Electrónico | Nombre del Usuario | Funciones Disponibles |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@universidad.edu.pe` | Administrador Sistema | Configuración global, logs y monitoreo |
| **Coordinador** | `coordinadora@universidad.edu.pe` | María Castillo Vega | Carga esquemas (`EsquemaPT`), define rúbricas y entrena datasets |
| **Asesor** | `jperez@universidad.edu.pe` | Dr. Jorge Pérez Sánchez | Crea tareas, evalúa tesis (rúbricas) e inserta anotaciones sobre el PDF |
| **Estudiante** | `ktorres@estudiante.edu.pe` | Torres Mendoza, Karla | Sube borradores, visualiza reportes de plagio e interactúa con el feedback |

---

## 🌟 Funciones Clave del Sistema

### 🤖 1. Análisis y Corrección con IA (Azure OpenAI)
Cuando un estudiante carga un avance de tesis (`.pdf` o `.docx`), el sistema dispara una tarea en segundo plano mediante **BullMQ** (`ai-analysis` queue):
1. **Extractor de Texto:** Analiza el documento y lo fragmenta en la base de datos.
2. **Evaluación de Esquema:** Utiliza el LLM de Azure OpenAI para calificar el avance en 4 dimensiones principales:
   - **Estructura (30%):** Verifica la existencia de secciones obligatorias (Realidad problemática, justificación, hipótesis, etc.).
   - **Contenido (40%):** Evalúa el rigor científico, la formulación de objetivos y coherencia del marco teórico.
   - **Forma (20%):** Valida estilo de redacción, márgenes, interlineado y citas APA 7.
   - **Originalidad (10%):** Analiza el aporte e innovación académica.
3. **Puntajes y Hallazgos:** Genera un resumen ejecutivo, puntaje global (escala vigesimal de 0 a 20) y un listado interactivo de **AIFinding** con ubicación exacta del error, pasos para corregirlo, ejemplos prácticos de redacción y recomendaciones bibliográficas.

### 📚 2. Verificador de Referencias Académicas (CrossRef + APA 7)
El sistema extrae de forma automática la sección final de bibliografía (`references` queue):
- Realiza consultas estructuradas vía Azure OpenAI estructurado para desglosar cada referencia.
- Analiza errores de estilo de la referencia en base a la norma APA 7.
- Otorga estados automáticos como `VERIFIED`, `DOI_MISSING` (falta el enlace DOI requerido), `POSSIBLE_HALLUCINATION` (la referencia parece inventada/inexistente), o `DOI_INCORRECT`.

### 🔍 3. Detección de Plagio y Escritura de IA
El módulo de plagio (`plagiarism-analysis` queue) tiene dos capas operacionales:
- **Similitud Vectorial Local (pgvector):** Realiza un análisis veloz de similitud coseno contra otros borradores y tesis del mismo programa universitario almacenados en la base de datos local.
- **Servicio Copyleaks:** Sube el documento original de forma segura. Detecta porcentajes de coincidencia web y analiza si el texto fue generado por herramientas de Inteligencia Artificial (ChatGPT, Claude, etc.), retornando un reporte interactivo con un PDF resaltado almacenado en S3.

### 🔁 4. Flujo de Retroalimentación Humana y Fine-Tuning (RLHF)
Para evitar alucinaciones y mejorar continuamente el motor de evaluación institucional:
- Los asesores revisan las observaciones generadas por la IA y deciden marcarlas como `Aceptadas` u `Observadas`.
- Si el asesor realiza una corrección a la sugerencia de la IA, el sistema almacena este par (`originalOutput` vs `humanCorrection`) en la tabla `FineTuningPair`.
- Los coordinadores pueden agrupar estos pares en un `FineTuningDataset` y programar un entrenamiento (Fine-Tuning) para ajustar los hiperparámetros y prompts del modelo de lenguaje en Azure.

---

## 🛠️ Comandos Útiles

El monorepo cuenta con scripts útiles a nivel raíz:

```bash
# Iniciar servicios del monorepo
npm run dev

# Generar builds de producción
npm run build

# Levantar Prisma Studio para explorar la base de datos visualmente
npm run db:studio

# Validar el formato de código con Prettier y ESLint
npm run lint

# Ejecutar el conjunto de pruebas unitarias y de integración
npm run test
```

También puedes ejecutar scripts individuales por aplicación mediante la CLI de Turbo:
```bash
npx turbo run dev --filter=api
npx turbo run dev --filter=web
```

---

## 🐳 Despliegue con Docker

El sistema se puede empaquetar para producción utilizando los `Dockerfile` que se encuentran dentro de `apps/api/` y `apps/web/`:

1. Asegúrate de configurar las variables del entorno de producción.
2. Construye las imágenes:
   ```bash
   docker compose -f docker-compose.yml build
   ```
3. Levanta la aplicación completa:
   ```bash
   docker compose -f docker-compose.yml up -d
   ```
   
Las colas de BullMQ procesarán de manera asíncrona todas las tareas de revisión pesadas sin interferir con la latencia de respuesta de los endpoints de la API REST de NestJS.
