# Mi Pensum Interactivo

Aplicación web para organizar, consultar y hacer seguimiento al progreso académico del programa de **Ingeniería Electrónica y Telecomunicaciones de la Universidad del Cauca**.

El proyecto permite visualizar el plan de estudios, controlar el estado de cada asignatura, consultar prerrequisitos, organizar el horario, registrar calificaciones y llevar una hoja de vida académica con historial de repitencias.

## Demo

La aplicación se encuentra desplegada en:

[https://pensum-unicauca.vercel.app](https://pensum-unicauca.vercel.app)

## Información del programa

- **Programa:** Ingeniería Electrónica y Telecomunicaciones.
- **Universidad:** Universidad del Cauca.
- **Duración:** 10 semestres.
- **Asignaturas:** 58.
- **Créditos académicos:** 169.
- **Requisitos adicionales de grado:** ECAES, suficiencia en idioma extranjero y actividad física formativa.

## Funcionalidades

### Pensum académico

- Visualización de materias organizadas por semestre.
- Estados para cada materia:
  - Pendiente.
  - En curso.
  - Aprobada.
- Validación de prerrequisitos.
- Identificación de materias bloqueadas y desbloqueadas.
- Consulta de materias que dependen de una asignatura.
- Aprobación individual o grupal de materias.
- Filtros por semestre y estado.
- Búsqueda por nombre o código.
- Ocultamiento automático de semestres completados.
- Seguimiento de créditos, materias aprobadas y porcentaje de avance.

### Repitencias y seguimiento académico

- Registro independiente del estado actual y del intento académico.
- Manejo de los niveles:
  - R1: primera repitencia.
  - R2: segunda repitencia.
  - R3: tercera repitencia.
- Acción explícita para registrar la pérdida de una materia.
- Conservación del nivel de repitencia después de aprobar.
- Historial de intentos perdidos y aprobados.
- Identificación de materias aprobadas como:
  - Aprobada R1.
  - Aprobada R2.
  - Aprobada R3.
- Seguimiento de:
  - Bajo rendimiento académico.
  - Matrícula condicional.
  - Matrículas condicionales utilizadas.
  - Sanción disciplinaria.
  - Derecho a continuar estudios.
  - Restricciones académicas activas.

### Hoja de vida académica

Vista independiente con información consolidada sobre:

- Situación académica actual.
- Antecedentes académicos.
- Materias aprobadas y pendientes.
- Repitencias activas e históricas.
- Intentos realizados por materia.
- Estado de matrícula condicional.
- Derecho a continuar estudios.
- Tabla académica ordenada por semestre.

La vista puede abrirse mediante:

```text
?view=student-record
```

### Horario académico

- Creación manual de clases.
- Selección de materia, día, hora de inicio y hora de finalización.
- Cuadrícula semanal de lunes a viernes.
- Visualización desde las 7:00 a. m. hasta las 11:00 p. m.
- Importación de oferta académica.
- Compatibilidad con archivos:
  - `.xlsx`
  - `.xls`
- Lectura de enlaces públicos de Google Drive y Google Sheets.
- Persistencia del horario en el navegador.

La vista puede abrirse mediante:

```text
?view=schedule
```

### Registro de notas

- Registro de calificaciones para las materias matriculadas.
- Organización de evaluaciones por cortes.
- Creación de elementos personalizados como:
  - Parciales.
  - Quices.
  - Talleres.
  - Trabajos.
  - Laboratorios.
  - Exposiciones.
- Asignación de porcentajes a cada actividad.
- Cálculo automático de aportes y resultados.
- Promedio académico del semestre.
- Indicador de aprobación con nota igual o superior a `3.0`.

### Experiencia de usuario

- Diseño responsive para computador, tableta y celular.
- Modo oscuro persistente.
- Alertas y confirmaciones con SweetAlert2.
- Fuente Montserrat.
- Navegación entre las vistas principales de la aplicación.
- Almacenamiento automático del progreso.

## Tecnologías utilizadas

- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- CSS
- [SweetAlert2](https://sweetalert2.github.io/)
- [React Icons](https://react-icons.github.io/react-icons/)
- SheetJS / XLSX
- Vercel Functions
- Local Storage

## Instalación local

### 1. Clonar el repositorio

```bash
git clone URL_DEL_REPOSITORIO
```

### 2. Entrar a la carpeta del proyecto

```bash
cd Pensum
```

### 3. Instalar las dependencias

```bash
npm install
```

### 4. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Vite mostrará una dirección local similar a:

```text
http://localhost:5173
```

Abre esa dirección en el navegador.

## Comandos disponibles

### Ejecutar el proyecto en desarrollo

```bash
npm run dev
```

### Comprobar la compilación de producción

```bash
npm run build
```

### Previsualizar la compilación

```bash
npm run preview
```

## Estructura principal

```text
Pensum/
├── api/
│   └── drive-file.ts
├── public/
├── src/
│   ├── components/
│   ├── data/
│   │   ├── curriculum.ts
│   │   ├── degreeRequirements.ts
│   │   ├── prerequisites.ts
│   │   └── defaultSchedule.ts
│   ├── hooks/
│   │   └── useLocalStorage.ts
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   └── main.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Persistencia de la información

El progreso académico, el horario, las notas y demás configuraciones se almacenan mediante `localStorage`.

Esto significa que:

- La información permanece después de recargar la página.
- Los datos se guardan en el navegador y dispositivo utilizados.
- Los datos no se sincronizan automáticamente entre dispositivos.
- Borrar los datos del navegador puede eliminar el progreso almacenado.
- El modo incógnito puede eliminar la información al cerrar la sesión.

## Importación de archivos académicos

La aplicación permite cargar archivos `.xls` y `.xlsx`.

Para importar desde Google Drive o Google Sheets:

1. El archivo debe tener acceso público mediante enlace.
2. Se debe copiar el enlace para compartir.
3. El enlace se pega dentro del módulo de importación.
4. La aplicación procesa el archivo mediante una función alojada en Vercel.

Los documentos privados o restringidos no pueden ser consultados por la aplicación.

## Despliegue

El proyecto puede desplegarse en Vercel.

Antes de publicar una nueva versión, se recomienda ejecutar:

```bash
npm run build
```

Después:

```bash
git add .
git commit -m "Descripción de los cambios"
git push origin main
```

Si el repositorio está conectado con Vercel, se iniciará automáticamente un nuevo despliegue.

## Consideraciones académicas

Esta aplicación es una herramienta de apoyo y organización personal.

No reemplaza:

- El sistema oficial de matrícula.
- La información de la División de Admisiones, Registro y Control Académico.
- Las decisiones de la Facultad.
- Las decisiones del Consejo de Facultad.
- El reglamento institucional vigente.

Los datos sobre prerrequisitos, repitencias, matrícula condicional y situación académica deben verificarse con las dependencias oficiales de la Universidad del Cauca.

## Estado del proyecto

El proyecto se encuentra en desarrollo activo.

Entre los módulos implementados se encuentran:

- Pensum interactivo.
- Prerrequisitos.
- Seguimiento del progreso.
- Repitencias.
- Hoja de vida académica.
- Seguimiento reglamentario.
- Horario académico.
- Importación de oferta académica.
- Registro y cálculo de notas.
- Modo oscuro.
- Diseño responsive.

## Objetivo del proyecto

El objetivo es centralizar en una sola aplicación las herramientas que un estudiante necesita para planificar su carrera, consultar el avance del pensum, organizar su horario, registrar sus notas y comprender su situación académica.

## Autora

Desarrollado por **Sara** como proyecto académico y tecnológico para estudiantes de Ingeniería Electrónica y Telecomunicaciones de la Universidad del Cauca.
