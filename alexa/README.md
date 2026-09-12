# Amazon Alexa — Mi pensum

Esta carpeta conserva la configuración reproducible de la skill de Alexa conectada a **Mi Pensum Unicauca**.

## Identidad de la skill

- **Nombre:** Mi pensum
- **Nombre de invocación:** `progreso académico`
- **Ejemplo de apertura:** `Alexa, abre progreso académico`
- **Idioma principal:** Español
- **Modelo de interacción versionado:** [`interaction-model.json`](./interaction-model.json)

> El archivo `interaction-model.json` es la fuente de verdad del modelo de voz en GitHub. Cuando se cambien intents, slots, materias o utterances, el mismo cambio debe importarse o replicarse en Alexa Developer Console y luego volver a compilar el modelo.

## Capacidades

La skill puede trabajar con la cuenta académica vinculada para:

- consultar progreso del pensum;
- consultar créditos aprobados y restantes;
- consultar materias en curso;
- consultar horario del día;
- consultar la próxima clase;
- consultar promedio del semestre;
- consultar materias por nota mínima;
- consultar notas de una materia;
- consultar un corte específico;
- consultar el acumulado de una materia;
- registrar una nota por voz;
- consultar la situación académica;
- cerrar la conversación mediante un intent propio o los intents estándar de Amazon.

## Backend de producción

La Lambda de Alexa consume las funciones serverless de Mi Pensum:

| Función | Endpoint |
| --- | --- |
| Cuenta y snapshot | `https://pensum-unicauca.vercel.app/api/alexa-account` |
| Progreso y créditos | `https://pensum-unicauca.vercel.app/api/alexa-progress` |
| Horario y próxima clase | `https://pensum-unicauca.vercel.app/api/alexa-schedule` |
| Notas y registro de notas | `https://pensum-unicauca.vercel.app/api/alexa-grades` |
| Situación académica | `https://pensum-unicauca.vercel.app/api/alexa-academic-status` |

Todos los endpoints académicos requieren un `Authorization: Bearer <access_token>` válido. El token identifica al usuario de Supabase y las políticas RLS limitan el acceso a su propio snapshot académico.

## Account Linking

Mi Pensum usa **Supabase Auth como servidor OAuth 2.1** para vincular la cuenta de Alexa con la cuenta web.

### Cliente OAuth registrado

- **Nombre:** Alexa - Mi pensum interactivo
- **Client ID:** `ca6a92d5-bcea-48ab-85d7-641a23c7e087`
- **Tipo:** Confidential
- **Grant types:** `authorization_code`, `refresh_token`
- **Token endpoint authentication:** `client_secret_post`
- **Scope actualmente utilizado:** `email`

### URLs de OAuth

- **Authorization URL:** `https://kdyjjbzahmyhbmuwrwzr.supabase.co/auth/v1/oauth/authorize`
- **Access Token URL:** `https://kdyjjbzahmyhbmuwrwzr.supabase.co/auth/v1/oauth/token`
- **Consent UI:** `https://pensum-unicauca.vercel.app/oauth/consent`

### Redirect URIs registradas

- `https://layla.amazon.com/api/skill/link/M2IK5UEJOEDHQE`
- `https://alexa.amazon.co.jp/api/skill/link/M2IK5UEJOEDHQE`
- `https://pitangui.amazon.com/api/skill/link/M2IK5UEJOEDHQE`

### Secreto del cliente

El **Client Secret nunca debe guardarse en GitHub**. Debe permanecer únicamente en la configuración segura de Account Linking de Alexa Developer Console y/o en un gestor de secretos autorizado.

## Flujo esperado de vinculación

1. El usuario habilita la skill desde Alexa.
2. Alexa inicia el flujo OAuth contra Supabase.
3. Supabase redirige al usuario a `/oauth/consent` en Mi Pensum.
4. Si no existe sesión web, el usuario inicia sesión.
5. Mi Pensum muestra el consentimiento de Alexa.
6. El usuario autoriza el acceso.
7. Supabase devuelve el código de autorización a Amazon.
8. Alexa intercambia el código por access token y refresh token.
9. La skill envía el access token a los endpoints `/api/alexa-*`.
10. Las funciones validan al usuario y consultan únicamente su snapshot académico.

## Pruebas mínimas antes de publicar una versión

Ejecutar en un dispositivo o simulador Alexa vinculado a una cuenta real:

1. `Alexa, abre progreso académico`.
2. `Cuál es mi progreso`.
3. `Cuántos créditos me faltan`.
4. `Qué materias tengo en curso`.
5. `Qué clases tengo hoy`.
6. `Cuál es mi próxima clase`.
7. `Cuál es mi promedio del semestre`.
8. `Cuáles son mis notas de Comunicaciones Digitales`.
9. `Qué nota tengo en el primer corte de Comunicaciones Digitales`.
10. `Cuál es el acumulado de Comunicaciones Digitales`.
11. Registrar una nota de prueba por voz y comprobar que aparece posteriormente en la web.
12. `Cuál es mi situación académica`.
13. `Salir de mi pensum`.

También deben verificarse los casos de error: cuenta sin vincular, token vencido, snapshot inexistente, materia no reconocida, actividad no reconocida, nota fuera de rango y ausencia de horario.

## Sincronización web ↔ Alexa

La información autenticada se guarda en `academic_snapshots` de Supabase. Los cambios realizados desde Alexa actualizan el snapshot y la aplicación web revisa revisiones de nube al recuperar foco, al volver a estar visible y periódicamente. Esto evita que una copia local antigua sobrescriba una modificación realizada por voz.

## Publicación en Alexa Developer Console

GitHub conserva el modelo y la documentación, pero la publicación final continúa realizándose en Amazon:

1. Importar o sincronizar `interaction-model.json`.
2. Build Model.
3. Verificar Endpoint/Lambda.
4. Verificar Account Linking usando los valores de este documento.
5. Ejecutar las pruebas de Development/Test.
6. Completar Distribution, Privacy & Compliance y Testing Instructions.
7. Ejecutar Validation.
8. Enviar a Certification cuando todas las validaciones estén en verde.

No publicar una versión si el modelo de Amazon difiere del archivo versionado en este repositorio.
