# Migración Supabase → Firebase (integración preparada, NO activada)

## Estado
La aplicación publicada sigue usando Supabase. No se han migrado usuarios, contraseñas ni datos. No se debe desactivar Supabase todavía.

El proyecto `mi-pensum-unicauca` fue creado por la propietaria en plan Spark y su aplicación web ya fue registrada. La rama incluye el SDK modular de Firebase, la configuración web en `src/lib/firebase.ts` y un adaptador de autenticación en `src/services/firebaseAuthService.ts` (registro, acceso, restauración de sesión, cierre y recuperación de contraseña). La inicialización es diferida y el adaptador todavía no se usa en las pantallas: conectar el login sin cambiar simultáneamente la sincronización mezclaría identidades de dos proveedores.

La configuración del cliente web identifica el proyecto y no concede privilegios administrativos. Nunca añadir credenciales de Admin al cliente. Analytics no se inicializa, porque no es necesario para esta migración.

El SDK incluye una dependencia Node de Firestore en gRPC. Se fuerza `@grpc/grpc-js >= 1.14.5` dentro de la versión mayor 1 para evitar las vulnerabilidades GHSA-m9gg-hp2v-232j y GHSA-f596-whhp-79r4 detectadas por la auditoría de dependencias. Esta dependencia Node no se usa en el cliente del navegador.

## Próximo paso en Firebase
1. En Authentication, habilitar el proveedor Correo electrónico/Contraseña.
2. Agregar `pensum-unicauca.vercel.app` a los dominios autorizados. Agregar `localhost` y el dominio de preview usado para las pruebas cuando corresponda (sin protocolo ni puerto).
3. Crear Cloud Firestore, confirmar edición Standard compatible con el objetivo Spark, elegir ubicación y usar modo producción. No usar modo de prueba con acceso público.
4. Obtener acceso administrativo para exportar/importar cuentas y datos y desplegar las reglas. El registro de la app web no autentica la CLI ni proporciona ese acceso.
5. Implementar la sincronización para la edición confirmada y conectar el adaptador de autenticación a las pantallas. Probar con cuentas de prueba antes de migrar estudiantes.

Mantener este PR como borrador hasta completar lo anterior, resolver Alexa y verificar la migración. No fusionar esta preparación como si ya resolviera el acceso de las cuentas existentes.

## Arquitectura objetivo
- Vercel + React/Vite para el frontend existente.
- Firebase Authentication (correo/contraseña).
- Cloud Firestore, colección `academic_snapshots`, documento por UID autenticado.
- Persistencia local por cuenta y cola de sincronización pendiente.
- Alexa: requiere sustituir el OAuth 2.1 de Supabase y revisar las funciones Vercel antes del cambio de proveedor.

## Preparación obligatoria
1. Crear o conectar un proyecto Firebase en Spark y registrar una aplicación web.
2. Habilitar Authentication con correo/contraseña y crear Firestore en modo producción.
3. Configurar dominios autorizados, incluido `pensum-unicauca.vercel.app`.
4. Auditar y exportar `academic_snapshots` y usuarios de Supabase, con respaldo cifrado y acceso restringido. Nunca subir datos personales ni credenciales al repositorio.
5. Determinar migración de identidad: no se deben cambiar UIDs sin mapear los snapshots. La migración de hashes de contraseñas exige compatibilidad verificada; de lo contrario usar restablecimiento de contraseña.
6. Adaptar AuthProvider, authService, academicSyncService, reglas de seguridad y funciones Alexa.
7. Verificar reglas con emulador: un usuario no debe poder leer/escribir snapshots de otro usuario.
8. Probar restauración, offline, reintentos, conflictos entre dispositivos, modo invitado y Alexa.
9. Publicar únicamente después de validar respaldos y pruebas. Retirar Supabase solo después de un período de verificación.

## Restricciones
El plan Spark está sujeto a cuotas. No activar Blaze ni servicios que requieran facturación sin autorización explícita. Firebase no implica disponibilidad ilimitada ni garantiza que el consumo permanezca siempre en cuota gratuita.
