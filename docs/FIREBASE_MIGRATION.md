# Migración Supabase → Firebase: prueba integrada, producción en Supabase

## Estado
El proyecto `mi-pensum-unicauca` fue creado por la propietaria en Spark. Correo/contraseña está habilitado y Firestore `(default)` fue creado en `nam5` con las reglas del repositorio publicadas manualmente. La integración utiliza las operaciones Core del SDK modular de Firestore para el objetivo Standard.

El PR #2 conecta acceso, registro, restauración de sesión y cierre con Firebase, junto con sincronización de snapshots por UID. La aplicación publicada continúa usando Supabase. No se han importado estudiantes, contraseñas, notas ni horarios. No se debe desactivar Supabase.

## Activación de la prueba
`VITE_BACKEND_PROVIDER=firebase` activa ambos adaptadores a la vez. Si no se define, se usa Supabase. En Vercel se configuró únicamente para Preview y la rama `migration/firebase-preparation`; no para producción ni otras ramas. No activar en producción antes de completar la migración.

La pantalla muestra un aviso para usar cuentas de prueba. El registro Firebase inicia sesión directamente; esta prueba todavía no exige verificación del correo. Las cuentas anteriores no aparecerán hasta importarlas de forma verificada.

La ruta `/oauth/consent` continúa usando Supabase, porque Alexa conserva su servidor OAuth y sus funciones Vercel. La prueba oculta las invitaciones y comandos de Alexa para evitar prometer acceso a datos de Firebase. Alexa todavía no consulta estos nuevos respaldos.

Para ejecutar localmente:

```sh
VITE_BACKEND_PROVIDER=firebase npm run dev
```

No se necesitan variables Supabase para el recorrido Firebase. La ruta heredada de consentimiento sí necesita `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Formato de datos y recuperación
Cada usuario guarda únicamente `academic_snapshots/{uid}`. Los campos del documento son `academic_data`, `schema_version` y `updated_at`. Se escribe `schema_version: 2` y `academic_data: { payload: JSON.stringify(datos) }`; el envoltorio sigue siendo un map compatible con las reglas publicadas. Este formato conserva claves de localStorage, Unicode y arrays anidados. La lectura también admite mapas de versión 1.

Todo importador debe preservar el UID o mantener un mapeo comprobado y usar este formato para los snapshots. El límite previo a la escritura es 850.000 bytes UTF-8 para dejar espacio dentro del documento de 1 MiB. Si se supera, se conserva la copia local y no se confirma el guardado.

La primera lectura se solicita al servidor; un fallo de conexión no se interpreta como una cuenta vacía. Si falla la recuperación inicial, se ofrece reintentar antes de mostrar el editor. Una edición pendiente tiene prioridad y permanece marcada hasta que el servidor confirma la escritura y su fecha. Se mantiene la cola y los reintentos existentes. La sincronización entre dispositivos ocurre al cargar la cuenta; los guardados reemplazan el snapshot completo y conservan el criterio existente de última escritura. No hay combinación automática de ediciones simultáneas.

## Validación realizada
El 10 de octubre de 2026 se ejecutó una prueba real con datos sintéticos en el proyecto indicado: registro y normalización de correo, inicio/cierre de sesión, observación de sesión, escritura con fecha de servidor, lectura posterior y recuperación después de volver a entrar. Se rechazaron la lectura sin sesión, lectura/escritura/borrado de otro usuario, listado de la colección, campos adicionales y un tipo inválido para `academic_data`. Las dos cuentas y el snapshot de prueba se eliminaron al terminar.

`npm run check` verifica lint, diez pruebas de cálculo/serialización y el build. También se compiló con `VITE_BACKEND_PROVIDER=firebase`. `npm audit --omit=dev --audit-level=high` no encontró vulnerabilidades. Persisten el aviso existente del parser y el aviso de tamaño del bundle.

La prueba real es optativa y crea cuentas sintéticas temporales; no se ejecuta en el check habitual:

```sh
FIREBASE_LIVE_CHECK=mi-pensum-unicauca npm run test:firebase
```

Estas comprobaciones verifican el acceso publicado actual; no sustituyen la auditoría de reglas, pruebas de navegador ni pruebas de desconexión y conflictos. Antes del lanzamiento deben completarse esas pruebas y revisar límites y validadores de reglas. No se modificaron las reglas en este paso.

## Pendiente antes del cambio de producción
1. Configurar/revisar los dominios autorizados, incluida la aplicación principal y el preview usado.
2. Conectar acceso administrativo a Firebase. La configuración web no autentica la CLI ni permite importar cuentas.
3. Auditar y respaldar usuarios y `academic_snapshots` de Supabase con cifrado y acceso restringido; nunca subir datos personales ni credenciales a GitHub.
4. Verificar compatibilidad de hashes de contraseña. Preservar UIDs y asociar todos los respaldos a la cuenta correcta. Si los hashes no son compatibles, preparar restablecimiento de contraseña; no unir cuentas solo por un correo sin verificar.
5. Ensayar restauración y comparar usuarios, cantidad de snapshots y contenido antes/después.
6. Resolver el reemplazo del OAuth de Alexa y adaptar sus funciones para Firebase, con pruebas de vinculación y consultas.
7. Probar en navegador sesión persistente, invitado, dos dispositivos, fallos de red, reintentos y cambios simultáneos. Auditar y probar las reglas con emulador.
8. Mantener este PR como borrador hasta completar lo anterior. Mantener Supabase durante el período de verificación.

## Configuración y costos
La configuración web identifica el proyecto y no concede privilegios administrativos. Nunca añadir credenciales Admin al cliente. Analytics no se inicializa.

Se fuerza `@grpc/grpc-js >= 1.14.5` dentro de la versión mayor 1 para evitar GHSA-m9gg-hp2v-232j y GHSA-f596-whhp-79r4 en la dependencia Node de Firestore; no se usa gRPC en el navegador.

Spark tiene cuotas. No activar Blaze, respaldos programados ni servicios que exijan facturación sin autorización explícita.
