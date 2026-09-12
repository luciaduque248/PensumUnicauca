# Mi Pensum Unicauca

Aplicación web para organizar, consultar y hacer seguimiento al progreso académico del programa de **Ingeniería Electrónica y Telecomunicaciones de la Universidad del Cauca**, con autenticación, sincronización en la nube e integración con **Amazon Alexa**.

## Demo

**Producción:** https://pensum-unicauca.vercel.app

## Qué resuelve

Mi Pensum centraliza en una sola aplicación información que normalmente queda distribuida entre el plan de estudios, el horario, apuntes personales y cálculos manuales de notas. El estudiante puede seguir su avance, gestionar materias y prerrequisitos, organizar el semestre, registrar calificaciones, revisar su situación académica y consultar parte de esta información por voz mediante Alexa.

## Funcionalidades

### Pensum académico

- Visualización del plan por semestre.
- Estados: pendiente, en curso y aprobada.
- Validación de prerrequisitos.
- Materias bloqueadas/desbloqueadas.
- Dependencias entre asignaturas.
- Filtros por semestre y estado.
- Búsqueda por nombre o código.
- Seguimiento de materias, créditos y porcentaje de avance.
- Requisitos adicionales de grado.

### Repitencias y seguimiento reglamentario

- Historial independiente de intentos académicos.
- Niveles R1, R2 y R3.
- Registro explícito de una materia perdida.
- Conservación del nivel de repitencia después de aprobar.
- Seguimiento de bajo rendimiento.
- Matrícula condicional y matrículas condicionales utilizadas.
- Sanción disciplinaria.
- Derecho a continuar estudios.
- Restricciones académicas activas.

### Hoja de vida académica

- Situación académica consolidada.
- Materias aprobadas, en curso y pendientes.
- Repitencias activas e históricas.
- Intentos por materia.
- Estado reglamentario.
- Tabla académica organizada por semestre.

### Horario académico

- Creación manual de clases.
- Una o dos franjas semanales por materia.
- Edición y eliminación.
- Detección de conflictos de horario.
- Cuadrícula semanal.
- Importación de oferta académica `.xls` y `.xlsx`.
- Lectura de enlaces públicos compatibles de Google Drive/Sheets.
- Confirmación del horario.
- Comparación de una nueva oferta con el horario existente.

### Registro de notas — estructura SIMCA 70/30

El cálculo reproduce la estructura utilizada en SIMCA para el esquema configurado:

- Corte 1 + Corte 2 comparten el `100 %` del componente que vale `70 %` de la definitiva.
- Corte 3 distribuye el `100 %` del componente que vale `30 %`.
- Los porcentajes del Parcial y de las actividades son editables.
- Se pueden agregar quices, talleres, trabajos, laboratorios, exposiciones, proyectos y otros ítems.
- El acumulado se conserva a dos decimales.
- La nota aproximada aplica redondeo institucional a una décima.
- Se calcula el promedio del semestre para registros completos.

Caso de referencia automatizado:

```text
Corte 1: 1.8 × 50 % = 0.90
Corte 2: 0.0 × 50 % = 0.00
Componente 70 %: 0.90 × 0.70 = 0.63
Corte 3: 0.0 × 100 % × 0.30 = 0.00
Acumulado: 0.63
Aproximado: 0.6
```

## Cuenta, modo invitado y persistencia

### Cuenta autenticada

La aplicación utiliza **Supabase Auth**. La información académica del usuario se consolida en `academic_snapshots` y se sincroniza con Supabase, lo que permite recuperar el progreso desde otra sesión o dispositivo.

Las políticas Row Level Security restringen el acceso para que cada usuario solo pueda consultar y modificar su propio snapshot.

### Modo invitado

El modo invitado no requiere cuenta. Sus datos permanecen únicamente en el navegador mediante almacenamiento local y no se sincronizan entre dispositivos.

## Amazon Alexa

Mi Pensum incluye una skill de Alexa conectada a los mismos datos académicos de la cuenta web.

- **Skill:** Mi pensum
- **Invocación:** `Alexa, abre progreso académico`
- **Account Linking:** OAuth 2.1 mediante Supabase Auth.
- **Consentimiento web:** `/oauth/consent`.

La skill permite consultar progreso, créditos, materias actuales, horario, próxima clase, promedio, notas, cortes, acumulados y situación académica. También puede registrar notas por voz.

La configuración versionada se encuentra en:

```text
alexa/
├── interaction-model.json
└── README.md
```

Consulta [`alexa/README.md`](./alexa/README.md) para la configuración de Account Linking, endpoints, pruebas y proceso de publicación.

## Backend para Alexa

Las funciones serverless viven en `api/`:

```text
api/
├── alexa-account.ts
├── alexa-progress.ts
├── alexa-schedule.ts
├── alexa-grades.ts
├── alexa-academic-status.ts
└── drive-file.ts
```

Los endpoints de Alexa validan el access token antes de consultar el snapshot del usuario.

## OAuth y vinculación de Alexa

Supabase funciona como servidor OAuth 2.1 con authorization code y refresh token. Mi Pensum implementa la pantalla de consentimiento y Alexa recibe un token que posteriormente utiliza para llamar los endpoints autenticados.

El **Client Secret no forma parte del repositorio**.

## Experiencia de usuario

- Responsive para escritorio, tableta y celular.
- Light mode y dark mode.
- Navegación entre Inicio, Vida académica, Hoja de vida académica, Horario y Notas.
- Tabla de notas desplazable horizontalmente en móvil.
- Bloques contextuales con comandos disponibles de Alexa.
- SweetAlert2 para confirmaciones y feedback.
- Montserrat.
- React Icons.

## Tecnologías

- React 19
- TypeScript
- Vite
- Supabase Auth + PostgreSQL
- Vercel + Vercel Functions
- CSS
- React Icons
- SweetAlert2
- SheetJS / XLSX
- Amazon Alexa Skills Kit
- OAuth 2.1

## Instalación local

```bash
git clone https://github.com/luciaduque248/PensumUnicauca.git
cd PensumUnicauca
npm install
npm run dev
```

La aplicación utiliza variables de entorno para conectarse a Supabase. No se deben guardar secretos directamente en el repositorio.

## Validación y pruebas

### Lint

```bash
npm run lint
```

### Pruebas automáticas

```bash
npm test
```

Las pruebas cubren la lógica crítica de notas 70/30, doble ponderación, porcentajes incompletos y redondeo institucional.

### Build

```bash
npm run build
```

### Validación completa

```bash
npm run check
```

`npm run check` ejecuta lint, pruebas y build. GitHub Actions ejecuta la misma validación automáticamente en `main` y en pull requests.

## QA

El checklist de cierre para web, sincronización y Alexa se encuentra en:

[`docs/QA_CHECKLIST.md`](./docs/QA_CHECKLIST.md)

Incluye pruebas de autenticación, pensum, repitencias, horario, notas, sincronización web ↔ Alexa, Account Linking y certificación.

## Estructura principal

```text
PensumUnicauca/
├── .github/
│   └── workflows/
│       └── ci.yml
├── alexa/
│   ├── interaction-model.json
│   └── README.md
├── api/
│   ├── alexa-account.ts
│   ├── alexa-progress.ts
│   ├── alexa-schedule.ts
│   ├── alexa-grades.ts
│   ├── alexa-academic-status.ts
│   ├── drive-file.ts
│   └── tsconfig.json
├── docs/
│   └── QA_CHECKLIST.md
├── public/
├── src/
│   ├── components/
│   ├── context/
│   ├── data/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── styles/
│   ├── types/
│   └── utils/
├── supabase/
├── tests/
│   └── gradeCalculations.test.ts
├── package.json
├── tsconfig.app.json
├── tsconfig.node.json
├── tsconfig.tests.json
└── vercel.json
```

## Seguridad

- Los usuarios autenticados acceden a su propia información mediante Supabase Auth.
- `academic_snapshots` está protegido mediante RLS.
- Los endpoints de Alexa requieren Bearer token.
- Los secretos OAuth no deben versionarse.
- Los clientes OAuth y redirect URIs deben mantenerse sincronizados con Alexa Developer Console.

## Despliegue

El repositorio está conectado con Vercel. Los commits a `main` generan despliegues de producción.

Antes de publicar cambios importantes:

```bash
npm run check
```

Además debe comprobarse que el despliegue de Vercel compile las funciones `api/` sin errores TypeScript.

## Estado del proyecto

**Web:** funcional y desplegada en producción.

**Backend/Supabase:** autenticación, sincronización y APIs de Alexa implementadas.

**Alexa:** integración funcional y modelo versionado. La publicación pública depende de completar/validar la versión correspondiente en Alexa Developer Console y, cuando aplique, enviarla al proceso de certificación de Amazon.

## Consideraciones académicas

Mi Pensum es una herramienta de apoyo y organización. No sustituye SIMCA, las decisiones de la Facultad, Registro y Control Académico ni el reglamento institucional vigente.

Los prerrequisitos, las condiciones reglamentarias y cualquier información institucional deben contrastarse con las fuentes oficiales de la Universidad del Cauca cuando se utilicen para tomar decisiones académicas.

## Autora

Desarrollado por **Sara Duque**.
