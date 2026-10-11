# Migración Supabase → Firebase: prueba integrada, producción en Supabase

## Estado
El proyecto `mi-pensum-unicauca` fue creado por la propietaria en Spark. Correo/contraseña está habilitado y Firestore `(default)` fue creado en `nam5` con las reglas del repositorio publicadas manualmente. La integración utiliza las operaciones Core del SDK modular de Firestore para el objetivo Standard.

El PR #2 conecta acceso, registro, restauración de sesión y cierre con Firebase, junto con sincronización de snapshots por UID. El 10 de octubre de 2026 se importaron las dos cuentas existentes y sus dos snapshots desde Supabase; se verificaron UIDs, correos, estado de verificación y contenido académico completo. La aplicación publicada continúa usando Supabase. No se debe desactivar Supabase.

## Activación de la prueba
`VITE_BACKEND_PROVIDER=firebase` activa ambos adaptadores a la vez. Si no se define, se usa Supabase. En Vercel se configuró únicamente para Preview y la rama `migration/firebase-preparation`; no para producción ni otras ramas. No activar en producción antes de completar la migración.

La pantalla indica que las cuentas anteriores ya están disponibles y que los cambios del preview no se sincronizan con la aplicación principal. El registro Firebase inicia sesión directamente; esta prueba todavía no exige verificación del correo. Se puede entrar con el correo y contraseña existentes. Los hashes bcrypt se importaron conservando los UIDs y los correos confirmados.

La copia corresponde al origen exportado el 10 de octubre de 2026 a las 18:48:47 de Bogotá (23:48:47 UTC). No existe replicación continua entre Supabase y Firebase. Antes del cambio de producción, reconciliar cualquier cambio posterior en cuentas o snapshots, revisando también las ediciones hechas en el preview para evitar sobrescribirlas.

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

`npm run check` verifica lint, diecisiete pruebas de cálculo/serialización/preparación de importación/autorización de APIs y el build. También se compiló con `VITE_BACKEND_PROVIDER=firebase`. `npm audit --omit=dev --audit-level=high` no encontró vulnerabilidades. Persisten el aviso existente del parser y el aviso de tamaño del bundle.

La prueba real es optativa y crea cuentas sintéticas temporales; no se ejecuta en el check habitual:

```sh
FIREBASE_LIVE_CHECK=mi-pensum-unicauca npm run test:firebase
```

Estas comprobaciones verifican el acceso publicado actual; no sustituyen la auditoría de reglas, pruebas de navegador ni pruebas de desconexión y conflictos. Antes del lanzamiento deben completarse esas pruebas y revisar límites y validadores de reglas. No se modificaron las reglas en este paso.

## Auditoría de cuentas y preparación de importación
El 10 de octubre de 2026 se revisó el origen `pensum-unicauca` (`kdyjjbzahmyhbmuwrwzr`) con consultas de solo lectura: dos cuentas activas, ambos correos confirmados, dos snapshots versión 1 de tipo object, sin respaldos huérfanos ni correos duplicados. Ambas contraseñas usan bcrypt `$2a$10$`; no se encontraron identidades de otros proveedores, factores MFA ni cuentas bloqueadas. El snapshot mayor ocupa 61.242 bytes en el JSON de origen.

`Firebase Authentication` admite importación BCRYPT. `scripts/firebaseMigrationPlan.ts` valida el origen, conserva UIDs y verificación de correo, codifica los bytes del hash bcrypt en base64 para el formato JSON de `auth:import`, conserva fechas y bloqueos y prepara snapshots versión 2. Rechaza cuentas repetidas, coincidencias de UID/correo en el destino, hashes no compatibles, MFA/proveedores no soportados, respaldos huérfanos y datos fuera de los límites. Su ejecución es únicamente local: no importa ni escribe datos.

`scripts/exportFirebaseMigration.sql` contiene la consulta de exportación de solo lectura. Se ejecutó y se conservó un respaldo cifrado AES-256-GCM, temporal y con acceso restringido, fuera del checkout. El inventario administrativo de Firebase estaba vacío y no había documentos de destino con los UIDs del origen. Se comprobó que el origen no había cambiado entre la exportación y la importación. Los archivos sensibles no se incluyeron en GitHub ni en artefactos públicos; Supabase conserva la información original. Antes del cambio de producción, guardar también un respaldo privado duradero con una clave recuperable.

Importar usuarios con la CLI autenticada y `--project mi-pensum-unicauca --hash-algo BCRYPT`; convertir la fecha ISO preparada para Firestore a Timestamp en el escritor administrativo. No escribir snapshots existentes sin compararlos primero. Si una importación queda parcial, revisar sus resultados antes de reintentar; la comprobación de colisiones impide sobrescribir usuarios automáticamente.

La propietaria completó la autorización OAuth de la CLI. Se confirmó acceso al proyecto indicado y Firestore Standard `(default)` en `nam5`, con `freeTier: true`. No se crearon claves de cuentas de servicio ni se activó facturación.

La importación real utilizó Firebase Admin SDK con la autorización OAuth de la CLI. Antes se importó una cuenta sintética con bcrypt `$2a$10$`, se comprobó su inicio de sesión con el SDK cliente y se eliminó. La importación de estudiantes devolvió dos éxitos y cero errores. Los snapshots se crearon en un batch con precondición de inexistencia; se conservaron las fechas `updated_at` como Timestamp. La verificación administrativa posterior comparó los dos UIDs, correos, verificación, bloqueos, fechas de cuenta a la precisión de segundos expuesta por UserMetadata, y cada JSON académico completo. Finalizó a las 18:52:06 de Bogotá. No se probaron las contraseñas personales de estudiantes; la compatibilidad de importación e inicio de sesión se verificó con la cuenta sintética.

La propietaria confirmó después que pudo entrar en el preview y que sus datos aparecen completos.

## Preparación de Alexa con datos de Firebase
Las cinco APIs académicas comparten `server/academicApiClient.ts`. `ALEXA_DATA_PROVIDER=firebase` cambia su almacenamiento a Firestore, independientemente de la variable del cliente web. La opción por defecto continúa siendo Supabase. No se ha activado esta variable en Vercel ni cambiado la Lambda o el servidor OAuth de Alexa.

El token sigue verificándose con Supabase Auth. Para consultar Firebase, el mismo UID debe existir como cuenta activa en Firebase Authentication. Nunca se vinculan datos por correo ni se acepta un UID del cuerpo o la URL de la petición. El adaptador decodifica snapshots versión 2 para conservar las respuestas existentes de progreso, horario, notas y situación académica. El registro de una nota usa la revisión leída de Firestore como precondición; si otra escritura gana, devuelve `409 snapshot_conflict` y conserva los datos recientes.

`server/firebaseServer.ts` prepara el acceso administrativo del servidor mediante OIDC de Vercel y Workload Identity Federation de Google, sin incluir credenciales en el cliente. La configuración prevista se limita al proyecto `pensum-unicauca` del equipo propietario y al entorno Preview; requiere una cuenta de servicio con acceso a datos Firestore y lectura de usuarios Firebase. El entorno local admite ADC privado para las pruebas. La identidad y los permisos de Vercel aún no se han creado: la revisión automática rechazó la creación del pool de identidad por ser un cambio de IAM que necesita autorización específica. La revisión posterior encontró cero pools y las APIs IAM/credenciales/STS seguían deshabilitadas. No se activó facturación ni se crearon claves de servicio.

Las variables necesarias del servidor, únicamente en Preview para la rama de migración, son `ALEXA_DATA_PROVIDER`, `GCP_PROJECT_ID`, `GCP_PROJECT_NUMBER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `GCP_WORKLOAD_IDENTITY_POOL_ID` y `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`. Antes de crear la federación debe verificarse su disponibilidad con Spark: la documentación de Google señala facturación habilitada como requisito previo. No habilitar facturación sin autorización; si el proyecto lo exige, detener esta alternativa y evaluar otra credencial de servidor con permisos mínimos.

La pantalla de consentimiento aclara el registro de notas por voz, que ya existía en la Lambda; antes decía incorrectamente que Alexa solo leía y no modificaba notas.

Las pruebas locales ahora incluyen rechazo de acceso sin token, token inválido, otro UID y configuración de proveedor desconocida. La prueba optativa `npm run test:alexa-firebase` requiere `FIREBASE_LIVE_CHECK=mi-pensum-unicauca` y ADC privado; utiliza Firebase real con cuentas temporales y simula únicamente la respuesta de verificación del token Supabase. No verifica un dispositivo Alexa, el flujo OAuth completo ni la federación de Vercel.

La prueba real del servidor pasó: las cinco APIs consultaron Firestore, el POST de notas conservó las demás secciones y la cuenta ajena, una revisión vencida no sobrescribió la nueva, y se rechazaron cuentas deshabilitadas y tokens inválidos. Las dos cuentas sintéticas y sus documentos se eliminaron al terminar. En este entorno se corrigió un bloqueo del transporte REST utilizando el transporte gRPC del SDK oficial; los datos de estudiantes no se modificaron.

Propuesta de permisos pendiente de autorización: una cuenta de servicio exclusiva del preview, `roles/datastore.user` para leer y guardar datos Firestore y `roles/firebaseauth.viewer` para comprobar cuentas activas. La federación deberá aceptar únicamente el sujeto de Vercel `owner:luciaduque248s-projects:project:pensum-unicauca:environment:preview`, con el emisor del equipo y su audiencia exacta. No conceder Owner, Editor, administración de usuarios ni acceso federado a producción. No activar el proveedor de datos Firebase del servidor hasta probar esos permisos en una petición real desde Vercel.

Este puente conserva la dependencia de Supabase Auth. Para retirarlo por completo, diseñar y probar un servidor OAuth compatible con la vinculación y renovación de Alexa, actualizar su consola y probar una vinculación real. No confundir el inicio de sesión Firebase del navegador con un servidor OAuth para Alexa.

## Pendiente antes del cambio de producción
1. Configurar/revisar los dominios autorizados, incluida la aplicación principal y el preview usado.
2. Conservar el acceso administrativo seguro. La configuración web no sustituye la autorización administrativa.
3. Guardar un respaldo privado duradero de usuarios y `academic_snapshots` con cifrado y acceso restringido; nunca subir datos personales ni credenciales a GitHub.
4. Reconciliar los cambios posteriores a la copia inicial, sin sobrescribir automáticamente las ediciones del preview.
5. Completar la comprobación de acceso de la propietaria en el navegador y ensayar recuperación desde el respaldo duradero. La comparación inicial de las dos cuentas y dos snapshots ya pasó.
6. Resolver el reemplazo del OAuth de Alexa y adaptar sus funciones para Firebase, con pruebas de vinculación y consultas.
7. Probar en navegador sesión persistente, invitado, dos dispositivos, fallos de red, reintentos y cambios simultáneos. Auditar y probar las reglas con emulador.
8. Mantener este PR como borrador hasta completar lo anterior. Mantener Supabase durante el período de verificación.

## Configuración y costos
La configuración web identifica el proyecto y no concede privilegios administrativos. Nunca añadir credenciales Admin al cliente. Analytics no se inicializa.

Se fuerza `@grpc/grpc-js >= 1.14.5` dentro de la versión mayor 1 para evitar GHSA-m9gg-hp2v-232j y GHSA-f596-whhp-79r4 en la dependencia Node de Firestore; no se usa gRPC en el navegador.

Spark tiene cuotas. No activar Blaze, respaldos programados ni servicios que exijan facturación sin autorización explícita.
