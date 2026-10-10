# Migración Supabase → Firebase (preparación, NO desplegada)

## Estado
Solo preparación. La aplicación publicada sigue usando Supabase. No se han migrado usuarios, contraseñas ni datos. No se debe desactivar Supabase todavía.

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
