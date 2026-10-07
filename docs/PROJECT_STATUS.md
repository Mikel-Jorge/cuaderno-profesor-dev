# Estado del proyecto

**Última actualización:** 2026-10-07
**Estado general:** Portada, Calendario, Horario, Alumnado, `4 Config` y `5 Seg` operativos; `6 Eval` gestionada vacía
**Versión vigente:** `1.6.2`
**Esquema vigente:** `10`

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
- Cálculos de lectividad, estadísticas, FEOE y repaso.
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

# Configuración de módulo — PONDERACIONES IMPLEMENTADAS

- Menú `Módulos` con creación y recálculo desde la hoja activa.
- Selector tematizado, limitado a actividades `MODULO` sin `4 Config` ya creada; al abrir sanea referencias huérfanas.
- Validación explícita de grupo, tipo, sesiones semanales, periodo lectivo y evaluaciones.
- Una sola configuración por `actividad_id`, enlazada por `sheet_id` en `_MOD_CONFIG`.
- `4 Config <SIGLA> · <GRUPO>` con calendario septiembre-junio homogéneo y tabla de 15 UT editables.
- UT con ID estable, orden por fila, horas manuales, color explícito y evaluación calculada por último día asignado.
- Resumen de horas con disponibles reales por evaluación y pendientes dinámicas por evaluación y total; sesiones disponibles escritas al crear o recalcular.
- Sesiones reales calculadas desde Horario y Calendario, excluyendo días no lectivos y FEOE del tipo de enseñanza.
- Distribución cronológica exacta por sesión persistida en `_MOD_PLAN`.
- Días de una UT, días mixtos solo cuando coinciden UT distintas, notas combinadas y limpieza por regeneración.
- Firma por fórmula para detectar cambios pendientes sin trigger.
- Estados por impartición y ayuda contextual en el Sidebar.
- Preparar nuevo curso elimina por identidad las Config gestionadas y sus registros tras el backup.
- Corregido el modal para que el aviso sin módulos sea exclusivo de ese estado, muestre carga real y haga visibles los errores sin perder la selección.
- La firma inicial y la aplicada se calculan en backend sin depender del recálculo inmediato de Sheets; la tabla UT vacía es válida.
- El rollback de creación limpia hoja, `_MOD_CONFIG` y `_MOD_PLAN` del módulo fallido y conserva los demás.
- El recálculo muestra modal tematizado de carga y resultado `success`, `warning` o `error`; el exceso de horas aborta antes de modificar calendario o plan.

## Funcionalidad 1.5.0

- Peso (%) editable por UT y Peso final editable por evaluación, dentro de la tabla y el resumen existentes.
- Sumas, estados y colores dinámicos de ponderación por evaluación y global; las filas sin UT no exigen peso.
- Migración de las combinaciones anteriores al recalcular, conservando datos y pesos existentes; las ponderaciones no forman parte de la firma temporal del calendario.
- `4 Config` conserva la autoridad para la futura referencia directa desde `6 Eval`; esquema `9` sin nuevas tablas técnicas.

## Correctivo 1.5.1

- Reparar incluye las `4 Config` válidas por identidad y migra su tabla inferior sin redistribuir UT ni alterar `_MOD_PLAN`.
- Color ocupa O:R, Evaluación S:U; el encabezado de Peso (%) tiene nota y el resumen se titula `RESUMEN DE HORAS Y PONDERACIONES`.
- Encabezados del resumen sin ajuste de línea y contenido de la tabla alineado a la izquierda. `4 Config` sigue en validación final.

## Correctivo 1.5.2

- Color comparte el fondo gris y el texto secundario de Evaluación en las 15 UT, tanto al crear como al reparar y recalcular; conserva su selector y valor.

## Correctivo 1.4.6

- Reparación explícita de registros `_MOD_CONFIG` sin hoja: elimina su registro y plan sin modificar otras Config; la UT perdida con la hoja no se inventa.
- Tabla inferior de 15 UT con celdas combinadas y resumen ancho, sin alterar la geometría de los meses.
- Fórmulas inmediatas para evaluación por última sesión, horas previstas por evaluación, total y sesiones pendientes o sobrantes.
- Sesiones disponibles limitadas a la última evaluación configurada, con FEOE y no lectivos excluidos.
- Recálculo con exceso validado antes de escribir, estados verde/ámbar/rojo y aviso de cambios pendientes destacado.
- Selector semanal de Horario con `SIGLA · GRUPO` para módulos, conservando `actividad_id`.
- Configuración de módulo continúa en validación manual; ponderaciones, Seguimiento y Evaluación siguen pendientes.

## Correctivo 1.4.7

- El proceso visible de Reparar 1.4.6 omitía la llamada al saneamiento, aunque `inicializarCuaderno()` sí la incluía.
- La limpieza de Config huérfana se ejecuta al abrir Crear, al crear en backend y en el proceso visible de Reparar; una hoja renombrada conserva su identidad por `sheet_id`.
- Se eliminan solo el registro huérfano y las filas del plan de su impartición y curso, con intento de restauración si falla una parte.
- Configuración de módulo sigue en validación manual.

## Correctivo 1.4.9

- El resumen dinámico consume las horas de UT en secuencia cronológica y reparte las UT que cruzan evaluaciones; solo la última puede mostrar exceso.
- La evaluación visible conserva la última evaluación configurada si las horas exceden la capacidad total.
- Se mantiene el esquema `9` y la planificación real de Recalcular.

## Correctivo 1.4.8

- Tabla UT con Color más ancho y Evaluación más compacta mediante combinaciones, sin cambiar los anchos del calendario.
- Resumen `Pendientes | Disponibles` por evaluación y total: disponibles por sesiones reales del periodo; pendientes por fórmulas ligadas a las horas y evaluación dinámica de las UT.
- Los pendientes negativos se destacan como error y el recálculo conserva su validación previa de exceso.
- Configuración de módulo continúa en validación final; las ponderaciones siguen pendientes.

Pendiente de cierre del bloque:

- validación visual y funcional completa en `CP_DEV`.

# Seguimiento y Evaluación — BLOQUE 1.6.0 IMPLEMENTADO

- Acción única de menú que crea conjuntamente `5 Seg` y `6 Eval`, con selector, spinner, bloqueo, identidad interna y rollback.
- `_MOD_CONFIG` ampliada con `seg_sheet_id` y `eval_sheet_id`; migración idempotente a esquema 10.
- `5 Seg` generado como snapshot desde `_MOD_PLAN`, agrupado por fecha + UT y sin dependencia de alumnado.
- Columnas exactas, campos editables, dropdown UT, Actual no negativo, acumulado independiente por UT y Total inicial autosuficiente.
- Colores/contraste por UT, exceso solo en texto rojo, Mejoras blanco/amarillo y cabecera congelada.
- Separadores dinámicos de evaluación, Navidad, Semana Santa y FEOE.
- Reparación in-place sin reseed ni pérdida de textos o cambios docentes; recreación aislada de `6 Eval` ausente.
- Preparar nuevo curso materializa y conserva `5 Seg OLD AACC`, elimina `6 Eval` y `4 Config` y limpia el registro activo.
- Sidebar, orden de familias e índice dinámico integrados.
- `6 Eval` es por ahora una hoja gestionada vacía. Alumnado, Moodle, Educa, notas, medias, ponderaciones y fórmulas quedan para el siguiente bloque.

## Correctivo 1.6.1

- El selector explica los requisitos de elegibilidad y el asistente de nuevo curso avisa del destino de Config, Eval y Seg OLD.
- `5 Seg` incorpora separadores de evaluación en mayúsculas, bordes discretos, alineación numérica y campos de escritura más anchos; sus reglas de color UT y exceso se reinstalan al crear o reparar.
- `4 Config` muestra el color de cada UT en la celda Color tras Recalcular y Reparar, y conserva gris cuando está vacía.
- Pestañas por familia con paleta fija; las hojas ajenas conservan su color. Esquema 10 sin cambios y `6 Eval` permanece vacía.

## Correctivo 1.6.2

- Acum. > Total conserva el fondo UT con texto rojo y negrita; el borde horizontal de `5 Seg` usa un gris más visible.
- La precarga de Semana Santa es un solo periodo y el configurador presenta las parejas heredadas como un bloque; sus fechas especiales tienen apertura exclusiva.
- UT, Horas, Peso y Color de `4 Config`, y las cuatro columnas numéricas del resumen, se centran al crear y reparar. Se mantiene el esquema 10 y `6 Eval` vacía.

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
- Futuro bloque `7 Tutoría` para centralizar las funciones del docente tutor; todavía sin hoja ni estructura técnica.

# Regla de actualización

Este archivo refleja únicamente lo implementado. Los requisitos futuros completos permanecen en `FUNCTIONAL_SPEC.md`.
