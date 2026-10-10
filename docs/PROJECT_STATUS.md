# Estado del proyecto

**Última actualización:** 2026-10-10
**Estado general:** Portada, Calendario, Horario, Alumnado, `4 Config`, `5 Seg` y `6 Eval` operativos
**Versión vigente:** `1.8.6`
**Esquema vigente:** `11`

## Correctivo de reparación, asistente y autoría 1.8.6

- Reparar Seguimiento y Evaluación juntos usa un solo paso y una lectura del registro; comunica recuentos por familia y solo reescribe `_MOD_CONFIG` si recrea una Evaluación.
- El asistente recibe del servidor los estados de visita, revisión, completitud y motivo. Datos generales comparte criterio con Ayuda; el resumen permite regresar a cada bloque. El selector de carpetas informa de carga, ruta, vacío y errores con reintento.
- Ayuda cuenta los completados y mantiene los pendientes visibles. La autoría textual visible usa «Mikel Jorge Soteras»; el monograma del recurso gráfico se conserva.
- Se retiraron el diálogo de confirmación sin invocadores, el resumen antiguo del asistente y envoltorios sin uso. `inicializarCuaderno` se conserva como entrada manual heredada.
- Pendiente de prueba manual en `CP_DEV`: reparación combinada con hojas reales, navegación/cancelación del asistente y selector de carpetas, y revisión visual de Ayuda y créditos.

## Correctivo UX y flujo 1.8.5

- Portada compacta desde A1, sin primera fila/columna vacía ni separación bajo los encabezados de datos e índice.
- Preparar nuevo curso guarda un borrador persistente por Spreadsheet en `DocumentProperties` y permite cancelarlo y retomarlo. Seguridad y los pasos intermedios no crean copia ni modifican hojas; la copia verificada, transición anual, aplicación del borrador y generación se ejecutan al finalizar. El esquema sigue en `11`.
- Stepper y Resumen usan los mismos estados visitado/revisado/pendiente. Los pasos futuros no muestran checks. La espera de carga, guardado y generación ocupa el contenido; Seguridad y Apariencia se compactan.
- Ayuda muestra pendientes directamente y solo ofrece «Ver completados» si existen elementos completos adicionales, sin duplicar pendientes.
- Pendiente de prueba manual en `CP_DEV`: recorrido completo del asistente, cancelación y reapertura, carpeta alternativa, fallo de Drive simulado y aspecto final de Portada/Sidebar.

## Correctivo de Preparar nuevo curso 1.8.4 (histórico)

- Seguridad conserva backup verificado, transición anual y recuperación defensiva. Los pasos de configuración guardan datos técnicos sin reconstruir hojas visibles; Finalizar o Cancelar después de Seguridad aplica una fase automática única de vistas y mantenimiento.
- Stepper navegable por pasos visitados: completado solo tras revisión, warnings ámbar con motivo y errores reales en rojo. Resumen en cards con el mismo estado. Loading central y formularios embebidos con altura dinámica y un único scroll.
- Seguridad y Apariencia compactas; selector de temas actualiza los tres colores. Actividades expande una sola ficha; Horario usa «Docente de apoyo».
- Pendiente de validación manual en `CP_DEV`: recorrido visual, cancelación tras guardados, scroll con muchas actividades y vistas finales con calendario u horario pendientes.

## Correctivo visual 1.8.3

- Diez presets claros en Configuración general y Preparar nuevo curso, con Verde profesional como opción inicial. Los IDs anteriores se resuelven por alias y sus colores originales sin personalización adoptan la nueva paleta; los colores personalizados permanecen. El esquema sigue en `11`.

## Correctivo UX 1.8.2

- Menú con icono a ambos lados y nombres claros en las tres opciones de Configuración.
- Seguridad del nuevo curso con texto breve y acción explícita; Datos del docente y centro mejor maquetados. Tramos, Actividades y Horario muestran solo su sección.
- En 1.8.2, stepper y resumen reflejaban datos guardados; 1.8.4 separa ese estado de la revisión del paso.
- Ayuda sin tarjeta «Estás en»; el detalle del estado sustituye a los pendientes y la búsqueda oculta el estado. Textos breves con acciones y viñetas.
- Se verifica por prueba que el reinicio anual vacía las fechas finales de evaluación en los cuatro tipos.

## Pulido 1.8.1

- Menú superior único con Configuración y Módulos; Ayuda al final y sin asistente independiente.
- Preparar nuevo curso recorre Seguridad, General, Calendario, Tramos, Actividades, Horario y Resumen en un diálogo, con copia verificada antes del reinicio y guardado por paso.
- Reparar estructura usa un selector compacto; Nombre en 6 Eval mide 132 px al crear o reparar.
- La Sidebar presenta búsqueda local sin tildes, contexto, estado resumido y FAQ con jerarquía propia. Es el refinamiento de UX previo al futuro bloque de Tutoría.

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
- Columnas visibles: `Apellidos`, `Nombre`, `Grupo`, `Email`, `REACA`, `Medidas`; UUID técnico oculto por alumno.
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
- Selector tematizado, limitado a actividades `MODULO` sin `4 Config` ya creada; la creación confirmada sanea referencias huérfanas.
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

- El selector de creación explica los requisitos de elegibilidad.
- `5 Seg` incorpora separadores de evaluación en mayúsculas, bordes discretos, alineación numérica y campos de escritura más anchos; sus reglas de color UT y exceso se reinstalan al crear o reparar.
- `4 Config` muestra el color de cada UT en la celda Color tras Recalcular y Reparar, y conserva gris cuando está vacía.
- Pestañas por familia con paleta fija; las hojas ajenas conservan su color. Esquema 10 sin cambios y `6 Eval` permanece vacía.

## Correctivo 1.6.2

- Acum. > Total conserva el fondo UT con texto rojo y negrita; el borde horizontal de `5 Seg` usa un gris más visible.
- La precarga de Semana Santa es un solo periodo y el configurador presenta las parejas heredadas como un bloque; sus fechas especiales tienen apertura exclusiva.
- UT, Horas, Peso y Color de `4 Config`, y las cuatro columnas numéricas del resumen, se centran al crear y reparar. Se mantiene el esquema 10 y `6 Eval` vacía.

## Correctivo 1.6.3

- `5 Seg` dibuja el borde inferior continuo de A:H y elimina el antiguo separador vertical C/D al crear o reparar.
- Los apartados principales del configurador de Calendario son exclusivos y reinician la apertura de fechas internas al cambiar de apartado.
- Versión 1.6.3 con esquema 10; `6 Eval` permanece vacía.

# Evaluación 1.7.0

- `3 Alumnado` añade REACA, Medidas y `alumno_id` oculto; Repair migra filas existentes de forma idempotente.
- `6 Eval` presenta UT activas por evaluación, medias calculadas y Educa manual; sus fórmulas referencian directamente las ponderaciones de `4 Config`.
- Repair migra las hojas vacías 1.6.x in-place, sincroniza alumnado por UUID y conserva notas y filas históricas. Las discrepancias estructurales de UT se avisan sin reconstrucción.
- Pendiente de validación manual en `CP_DEV`: pesos reactivos, valores y formato de notas, REACA/Notes, altas y bajas, migración de Eval previa y revisión visual.

# Correctivo 1.7.1

- REACA instala checkbox nativo y normaliza valores booleanos y textos heredados `TRUE`/`FALSE` al reparar.
- Eval usa tema global, cabecera de tres filas con pesos UT en vivo, columna Medidas, notas compactas y Educa siempre amarilla y en negrita.
- Repair ordena por `alumno_id` sin desplazar notas; incorpora `MEDIA DEL GRUPO` con vacíos UT como cero y `MH` como diez solo para promedio Educa.
- Protecciones `CUADERNO:` de solo advertencia en rangos generados; entradas docentes y protecciones externas se conservan.
- `6 Eval` permanece en validación manual en `CP_DEV`. `7 Tutoría` continúa como bloque futuro.

# Versión 1.8.0

- Reparar estructura ofrece selección de siete bloques visibles y progreso dinámico; el mantenimiento técnico se ejecuta siempre. Se separan las reparaciones de Config, Seg y Eval y las protecciones de hojas no elegidas se respetan.
- Eval alinea explícitamente nombre y apellidos después de ordenar, integra la cabecera final con el accent del tema y ensancha las dos columnas finales.
- Historial 1.8.0: el asistente explícito de seis pasos usaba los configuradores de datos generales, Calendario y Horario. Fue sustituido por el diálogo único de siete pasos en 1.8.1.
- Menús reordenados, nombre visible Reparar estructura y ayuda ampliada en Sidebar y `USER_GUIDE.md`.
- Abrir los configuradores o Crear configuración de módulo es solo lectura; la creación confirmada sanea Config huérfanas.
- Pendiente de validación manual en `CP_DEV`: recorrido de asistente, Repair con combinaciones de selección, protección e inspección visual de Eval.

# Decisiones vigentes

- No existe `3 Módulos`.
- No existen `_MODULOS`, `_MATRICULAS` ni `_UT`; `_MOD_CONFIG` y `_MOD_PLAN` no duplican los campos editables de UT.
- Imparticiones con igual sigla y distinto grupo son independientes.
- Las familias 4/5/6 se ordenan agrupadas por tipo; la familia 5 agrupa activos e históricos por sigla independientemente del grupo.
- Las hojas no gestionadas no se borran ni renombran.
- Los colores nunca son fuente de verdad.
- No hay triggers instalables, People API ni Google Calendar en V1.

# Futuro / roadmap

- Función global `Cambiar tema del cuaderno` cuando estén construidas las hojas principales.
- Futuro bloque `7 Tutoría` para centralizar las funciones del docente tutor; todavía sin hoja ni estructura técnica.

# Regla de actualización

Este archivo refleja únicamente lo implementado. Los requisitos futuros completos permanecen en `FUNCTIONAL_SPEC.md`.
