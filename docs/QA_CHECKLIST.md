# QA de cierre — Mi Pensum Unicauca + Alexa

Este documento define las pruebas mínimas para considerar una versión lista para producción y para demo de portafolio.

## 1. Acceso y autenticación

- [ ] La portada permite iniciar sesión.
- [ ] Las credenciales válidas abren la aplicación sin `Failed to fetch`.
- [ ] Las credenciales inválidas muestran un error comprensible.
- [ ] Cerrar sesión elimina la sesión actual sin borrar los datos de nube.
- [ ] Crear una cuenta nueva funciona.
- [ ] El modo invitado funciona sin Supabase y mantiene sus datos únicamente en el navegador.
- [ ] Una cuenta autenticada recupera su snapshot después de cerrar sesión e iniciar sesión nuevamente.
- [ ] La misma cuenta recupera su información en otro navegador/dispositivo.

## 2. Pensum y progreso académico

- [ ] Las materias se muestran en el semestre correcto.
- [ ] La búsqueda funciona por nombre y código.
- [ ] Los filtros por estado y semestre funcionan.
- [ ] Los prerrequisitos bloquean y desbloquean correctamente.
- [ ] Marcar una materia como aprobada actualiza materias, créditos y porcentaje.
- [ ] Registrar una pérdida incrementa correctamente el historial de repitencia.
- [ ] R1, R2 y R3 se conservan después de aprobar una materia.
- [ ] Reiniciar progreso solicita confirmación antes de modificar los datos.

## 3. Hoja de vida y situación académica

- [ ] La hoja de vida refleja los estados actuales del pensum.
- [ ] Historial de intentos y repitencias coincide con los datos registrados.
- [ ] Bajo rendimiento, matrícula condicional y derecho a continuar se muestran coherentemente.
- [ ] La tabla se puede consultar correctamente en celular.

## 4. Horario

- [ ] Se puede agregar una materia manualmente.
- [ ] Se pueden registrar una o dos franjas por materia.
- [ ] Se detectan cruces de horario.
- [ ] Se puede editar una materia ya registrada.
- [ ] Se puede eliminar una materia.
- [ ] Importar `.xls` y `.xlsx` funciona con un archivo válido.
- [ ] Importar desde enlace público compatible funciona.
- [ ] Confirmar horario conserva las clases registradas.
- [ ] Una nueva oferta permite detectar cambios sobre el horario existente.
- [ ] Desktop, tablet y celular no presentan desbordamientos o superposiciones.

## 5. Notas — esquema SIMCA 70/30

- [ ] Corte 1 + Corte 2 distribuyen conjuntamente el 100 % del componente del 70 %.
- [ ] Corte 3 distribuye el 100 % del componente del 30 %.
- [ ] El porcentaje del Parcial es editable.
- [ ] Agregar una actividad no produce doble ponderación.
- [ ] Caso de referencia: `1.8 @ 50 %`, `0 @ 50 %`, `0 @ 100 %` produce `0.63` acumulado y `0.6` aproximado.
- [ ] El acumulado se conserva a dos decimales.
- [ ] La aproximación institucional usa una décima.
- [ ] Un componente incompleto no se marca como cálculo completo.
- [ ] El promedio del semestre se calcula únicamente con materias completas según la lógica vigente.
- [ ] En celular toda la tabla se puede desplazar horizontalmente; ninguna columna queda fija.

Estas reglas también se cubren mediante `npm test`.

## 6. Sincronización de nube

- [ ] Un cambio web autenticado se guarda en `academic_snapshots`.
- [ ] Al recargar se recupera el último snapshot válido.
- [ ] Dos sesiones de la misma cuenta convergen a la revisión más reciente.
- [ ] Un cambio realizado desde Alexa aparece en la web al recuperar foco o durante el refresco periódico.
- [ ] Un snapshot local antiguo no pisa un cambio más reciente hecho desde Alexa.
- [ ] Las políticas RLS impiden que un usuario lea o modifique el snapshot de otro usuario.

## 7. UI/UX

- [ ] Light mode y dark mode funcionan en todas las vistas.
- [ ] El tema persiste según el comportamiento definido.
- [ ] Navegación: Inicio, Vida académica, Hoja de vida académica, Horario y Notas.
- [ ] El bloque de Alexa aparece después del hero y no colisiona con la primera tarjeta de contenido.
- [ ] El logo de Alexa carga correctamente.
- [ ] El bloque de comandos se adapta a móvil.
- [ ] No hay texto desbordado en la tabla de notas.
- [ ] No hay barras horizontales globales no deseadas.

## 8. Alexa — Account Linking

- [ ] Habilitar la skill solicita vinculación cuando no existe token.
- [ ] El login OAuth abre Mi Pensum y conserva `authorization_id`.
- [ ] Aprobar consentimiento devuelve correctamente a Alexa.
- [ ] Después de vincular, `Alexa, abre progreso académico` reconoce la skill.
- [ ] Un token vencido solicita revincular la cuenta.
- [ ] Revocar el grant impide nuevas consultas hasta volver a autorizar.

## 9. Alexa — consultas

- [ ] Progreso.
- [ ] Créditos aprobados/restantes.
- [ ] Materias en curso.
- [ ] Horario de hoy.
- [ ] Próxima clase.
- [ ] Promedio del semestre.
- [ ] Materias por nota mínima.
- [ ] Notas de una materia.
- [ ] Nota de un corte.
- [ ] Acumulado de una materia.
- [ ] Situación académica.
- [ ] Salida/cancelación de la skill.

## 10. Alexa — escritura de notas

- [ ] Alexa reconoce materia, corte, nota y actividad.
- [ ] Rechaza notas fuera del rango permitido.
- [ ] Informa cuando una materia no existe o es ambigua.
- [ ] Informa cuando una actividad no existe.
- [ ] La actualización se guarda en Supabase.
- [ ] La web recibe después el dato actualizado.
- [ ] El nuevo valor produce el mismo cálculo que la interfaz web.

## 11. Calidad técnica

Antes de fusionar/publicar:

```bash
npm ci
npm run check
```

`npm run check` debe completar:

1. ESLint.
2. Pruebas automáticas.
3. TypeScript + build Vite.

Además, la compilación de Vercel debe terminar sin errores TypeScript de las funciones `api/`.

## 12. Alexa Developer Console antes de certificación

- [ ] El interaction model de Amazon coincide con `alexa/interaction-model.json`.
- [ ] Build Model finaliza correctamente.
- [ ] Endpoint/Lambda corresponde a la versión probada.
- [ ] Account Linking coincide con `alexa/README.md`.
- [ ] Todos los example phrases funcionan en Development/Test.
- [ ] Distribution completada.
- [ ] Privacy & Compliance completada.
- [ ] Testing Instructions completadas.
- [ ] Validation sin errores.
- [ ] Submit for Certification.
