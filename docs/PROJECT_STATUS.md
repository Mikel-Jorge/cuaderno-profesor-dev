# Estado del proyecto

**Última actualización:** 2026-10-03
**Estado general:** Portada, Calendario, Horario, Alumnado y primera fase de `4 Config` operativos
**Versión vigente:** `1.4.6`
**Esquema vigente:** `9`

# Completado

## Núcleo y Portada

- Proyecto Apps Script vinculado a `CP_DEV`, con `clasp` y Git/GitHub configurados.
- `_CONFIG` y `_META` ocultas, versión centralizada y valores de versión escritos como texto.
- `0 Portada` generada, temática y alimentada desde `_CONFIG`.
- Índice dinámico navegable de todas las hojas visibles, excluyendo `_...`.
- Datos generales, temas claros y branding común en diálogos y Sidebar.
- Infraestructura de confirmaciones y procesos con progreso.
- Preparar nuevo curso con backup obligatorio verificado, movimiento opcional, renombrado y transición anual coordinada con snapshots y recuperación defensiva.
- Conservación de profesor, centro, tema, tramos y actividades; limpieza de Alumnado, sesiones/apoyos y configuración anual del Calendario.

## Calendario — CERRADO / COMPLETADO

- Modelo normalizado en `_CAL_TIPOS`, `_CAL_EVALUACIONES`, `_FECHAS` y `_CAL_FECHA_TIPOS`.
- Tipos de enseñanza, evaluaciones, periodos, fechas especiales, solapamientos y prioridad visual.
- Cálculos de lectividad, estadísticas, prácticas y repaso.
- `1 Calendario` septiembre-junio, notas, tema, recorte y regeneración idempotente.
- Precarga editable de festivos habituales, Navidad 24/12–06/01 y Semana Santa calculada mediante Pascua gregoriana.
- Regeneración limpia de notas y marcas; meses y propuestas visibles aunque los tipos estén pendientes.
- Estado y ayuda contextual en el Sidebar.

## Horario — CERRADO / COMPLETADO

- Modelo de tramos consecutivos en `_HOR_TRAMOS`.
- Actividades y categorías, con actividades `MODULO` como catálogo definitivo de imparticiones.
- Sesiones semanales y apoyo por sesión en `_HOR_SESIONES`.
- Configurador, validación, persistencia y migración idempotente.
- `2 Horario` con semana dinámica, RichText, colores, descansos, apoyo y tramo actual resaltado con fondo contrastado.
- Semana actual de lunes a viernes y semana siguiente durante sábado y domingo.
- Sidebar, Portada y reparación integrados.
- `actividad_id` fijado como identidad estable de cada impartición; no se creará `3 Módulos` ni `_MODULOS`.

# Alumnado — FUNCIONANDO

- Creada `3 Alumnado` como hoja global, visible y editable.
- Columnas exactas: `Apellidos`, `Nombre`, `Grupo`, `Email`.
- Tema, anchos, cabecera congelada, Email en texto y área preparada para pegado.
- Reparación idempotente que conserva las filas de alumnado.
- Estado `Pendiente`/`Configurado` y ayuda contextual en el Sidebar; Email no es obligatorio.
- Preparar nuevo curso limpia los datos del activo después del backup y conserva la estructura.
- Índice dinámico y orden de hojas gestionadas integrados.
- Reparación secuencial corregida: sus respuestas al navegador contienen solo datos serializables y los errores identifican el paso fallido sin dejar el spinner activo.

Pendiente de cierre del bloque:

- validación manual en `CP_DEV` de creación, pegado, estado, reparación y limpieza anual;
- confirmación visual del tema y de la posición tras `2 Horario`.

# Configuración de módulo — PRIMERA FASE IMPLEMENTADA

- Menú `Módulos` con creación y recálculo desde la hoja activa.
- Selector tematizado y de solo lectura al abrir, limitado a actividades `MODULO` sin `4 Config` ya creada.
- Validación explícita de grupo, tipo, sesiones semanales, periodo lectivo y evaluaciones.
- Una sola configuración por `actividad_id`, enlazada por `sheet_id` en `_MOD_CONFIG`.
- `4 Config <SIGLA> · <GRUPO>` con calendario septiembre-junio homogéneo y tabla de 15 UT editables.
- UT con ID estable, orden por fila, horas manuales, color explícito y evaluación calculada por último día asignado.
- Resumen de horas con fórmulas para previstas por evaluación, total y diferencia; sesiones disponibles escritas al crear o recalcular.
- Sesiones reales calculadas desde Horario y Calendario, excluyendo días no lectivos y prácticas del tipo de enseñanza.
- Distribución cronológica exacta por sesión persistida en `_MOD_PLAN`.
- Días de una UT, días mixtos solo cuando coinciden UT distintas, notas combinadas y limpieza por regeneración.
- Firma por fórmula para detectar cambios pendientes sin trigger.
- Estados por impartición y ayuda contextual en el Sidebar.
- Preparar nuevo curso elimina por identidad las Config gestionadas y sus registros tras el backup.
- Corregido el modal para que el aviso sin módulos sea exclusivo de ese estado, muestre carga real y haga visibles los errores sin perder la selección.
- La firma inicial y la aplicada se calculan en backend sin depender del recálculo inmediato de Sheets; la tabla UT vacía es válida.
- El rollback de creación limpia hoja, `_MOD_CONFIG` y `_MOD_PLAN` del módulo fallido y conserva los demás.
- El recálculo muestra modal tematizado de carga y resultado `success`, `warning` o `error`; el exceso de horas aborta antes de modificar calendario o plan.

## Correctivo 1.4.6

- Reparación explícita de registros `_MOD_CONFIG` sin hoja: elimina su registro y plan sin modificar otras Config; la UT perdida con la hoja no se inventa.
- Tabla inferior de 15 UT con celdas combinadas y resumen ancho, sin alterar la geometría de los meses.
- Fórmulas inmediatas para evaluación por última sesión, horas previstas por evaluación, total y sesiones pendientes o sobrantes.
- Sesiones disponibles limitadas a la última evaluación configurada, con prácticas y no lectivos excluidos.
- Recálculo con exceso validado antes de escribir, estados verde/ámbar/rojo y aviso de cambios pendientes destacado.
- Selector semanal de Horario con `SIGLA · GRUPO` para módulos, conservando `actividad_id`.
- Configuración de módulo continúa en validación manual; ponderaciones, Seguimiento y Evaluación siguen pendientes.

Pendiente de cierre del bloque:

- ponderaciones UT → evaluación y evaluación → curso;
- validación visual y funcional completa en `CP_DEV`.

# Futuro

## Seguimiento

- `5 Seg <SIGLA> · <GRUPO>`.
- Generado desde sesiones reales y UT.
- Sin dependencia de alumnado.

## Evaluación

- `6 Eval <SIGLA> · <GRUPO>`.
- Alumnado seleccionado inicialmente por Grupo.
- Fórmulas referenciando `4 Config`, sin duplicar ponderaciones.
- Notas de UT desde Moodle y columnas manuales Educa por evaluación y final.

Las hojas 5 y 6 no están implementadas. Preparar nuevo curso ya elimina las hojas 4 registradas; la futura eliminación de 6 y el archivado de 5 como `OLD AACC` sin referencias rotas siguen pendientes.

# Decisiones vigentes

- No existe `3 Módulos`.
- No existen `_MODULOS`, `_MATRICULAS` ni `_UT`; `_MOD_CONFIG` y `_MOD_PLAN` no duplican los campos editables de UT.
- Imparticiones con igual sigla y distinto grupo son independientes.
- Las familias 4/5/6 se ordenan agrupadas por tipo; la familia 5 agrupa activos e históricos por sigla independientemente del grupo.
- Las hojas no gestionadas no se borran ni renombran.
- Los colores nunca son fuente de verdad.
- No hay triggers instalables, People API ni Google Calendar en V1.

# Mejora aplazada

- Función global `Cambiar tema del cuaderno` cuando estén construidas las hojas principales.
- Posible traslado futuro de `Inicializar / reparar estructura` a un área de mantenimiento.

# Regla de actualización

Este archivo refleja únicamente lo implementado. Los requisitos futuros completos permanecen en `FUNCTIONAL_SPEC.md`.
