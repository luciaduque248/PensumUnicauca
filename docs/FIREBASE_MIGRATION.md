# Migración de Supabase a Firebase (plan Spark)

## Estado

**Plan de migración; NO ejecutada.** La aplicación de producción sigue utilizando Supabase. No desconectar ni eliminar Supabase antes de completar las verificaciones.

## Requisitos

- Proyecto Firebase creado en plan **Spark**, sin facturación activada.
- Firebase Authentication: proveedor correo/contraseña habilitado; dominios autorizados para Vercel.
- Cloud Firestore: reglas de seguridad por usuario, nunca permitir lectura o escritura global.
- Exportación verificable de los usuarios y de `academic_snapshots` antes de modificar producción.
- Pruebas de Alexa: el account linking OAuth existente usa Supabase y debe adaptarse, no solo sustituir la SDK web.

## Esquema propuesto

Colección `academicSnapshots`, documento con ID igual al UID de Firebase:

```json
{
  "academicData": {},
  "schemaVersion": 1,
  "updatedAt": "server timestamp",
  "migratedFromSupabaseUserId": "uuid original"
}
```

El mapeo de identificadores antiguos a Firebase UID se debe mantener en un proceso administrativo protegido. Nunca exponer datos de otros estudiantes al cliente.

## Reglas mínimas de Firestore

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /academicSnapshots/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Las reglas deben endurecerse con validación de campos/tamaños antes de producción. Probar explícitamente que un usuario no puede acceder al documento de otro.

## Migración segura

1. Respaldar base de datos y exportar snapshots con identificadores de usuario, verificando conteos y muestras.
2. Crear proyecto Firebase Spark y configurar Auth, Firestore y reglas; confirmar cuotas actuales y restricciones.
3. Implementar adaptadores de autenticación y sincronización en una rama, manteniendo la app actual operativa.
4. Migrar cuentas mediante un mecanismo de vinculación verificada o restablecimiento de contraseña. **No almacenar ni solicitar contraseñas existentes.**
5. Transferir cada snapshot al UID Firebase correspondiente con herramienta administrativa segura y comprobar integridad.
6. Adaptar y probar OAuth/account linking y funciones de Alexa antes del cambio.
7. Probar modo invitado, acceso desde navegador nuevo, recuperación de contraseña, notas, horario, progreso, RLS y funcionamiento offline.
8. Publicar gradualmente en Vercel con capacidad de reversión; mantener Supabase hasta validar todos los usuarios migrados.

## Riesgos

- Firebase Spark tiene cuotas gratuitas, no disponibilidad ilimitada garantizada. No activar servicios que requieran Blaze ni facturación sin autorización.
- Los datos locales de usuarios registrados se almacenan por cuenta en el navegador; no son un sustituto de una copia de seguridad de la nube.
- Una exportación JSON contiene datos académicos personales; debe almacenarse de forma privada.
- Una migración de autenticación incompleta puede impedir que estudiantes accedan a sus datos.
