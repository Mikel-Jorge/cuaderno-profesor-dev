# Arquitectura técnica

**Estado:** vigente
**Última revisión:** 2026-10-10
**Versión:** `1.8.3` / esquema `11`

Este documento describe la arquitectura técnica. El comportamiento esperado se define en `FUNCTIONAL_SPEC.md` y el estado real en `PROJECT_STATUS.md`.

# 1. Plataforma y criterios

- Google Sheets como interfaz principal.
- Google Apps Script V8 vinculado al Spreadsheet.
- HTML/CSS/JavaScript de Apps Script para diálogos y Sidebar.
- `clasp` para sincronización local → Apps Script.
- Git/GitHub como fuente de verdad del código versionado.
- Operaciones por bloques y sin dependencias externas innecesarias.

La apertura de configuradores no crea, repara, oculta, reordena ni renderiza hojas. Crear configuración de módulo muestra los registros huérfanos como disponibles sin mutarlos; el backend de creación limpia esas referencias después de confirmar. Un guardado solo persiste el modelo afectado y actualiza sus vistas derivadas necesarias.

`UiDialogRepair.html` recoge siete booleanos serializables. `Ui.gs` normaliza la selección y construye los pasos visibles del progreso. El mantenimiento de tablas técnicas y huérfanos se ejecuta siempre; `Setup.gs` cierra con metadatos, ocultación, orden y `Protections.gs` instala protecciones solo de los bloques seleccionados más hojas técnicas y OLD. Durante un paso de Repair sin Portada, `CP_REPAIR_SKIP_COVER` impide que los helpers de calendario, horario o módulos regeneren indirectamente su índice. `Tracking.gs` permite recorrer Seguimiento y Evaluación por separado. La selección viaja como DTO y nunca contiene objetos de Apps Script.

`UiDialogNewCourse.html` mantiene un solo popup. Calendario y Horario reutilizan sus formularios dentro de él, sin abrir otros diálogos. Los pasos de Horario ocultan y deshabilitan las secciones ajenas al paso actual. El stepper y el resumen consultan `getCourseWizardSummary_()` para distinguir apartados configurados y pendientes. La apertura normal del libro sigue sin escrituras ni diálogos.

Los colores son siempre presentación. Ningún cálculo reconstruye datos desde fondos o estilos.

# 2. Componentes actuales

- `Config.gs`: constantes, nombres de hojas, versión `1.8.3`, esquema `11` y paleta fija de pestañas.
- `Theme.gs`: tema global, presets, aliases de compatibilidad y colores semánticos. La lectura detecta tríos originales sin personalización para aplicar la nueva paleta; la reparación persiste el ID canónico y los colores resueltos.
- `Main.gs`: menú principal.
- `Setup.gs`: inicialización y reparación idempotente.
- `GeneralConfig.gs`: `_CONFIG` y datos generales.
- `Calendar.gs`: modelo y vista del calendario escolar.
- `Schedule.gs`: modelo, validación, persistencia y consultas de Horario.
- `ScheduleView.gs`: renderizado de `2 Horario`.
- `Students.gs`: estructura, tema, estado y limpieza anual de `3 Alumnado`.
- `ModuleConfig.gs`: registro, creación, calendario, UT y planificación de `4 Config`.
- `Tracking.gs`: creación conjunta, snapshot, reparación y archivo anual de `5 Seg`/`6 Eval`.
- `Evaluation.gs`: layout, fórmulas y sincronización conservadora de `6 Eval`.
- `Protections.gs`: protecciones de advertencia propias e idempotentes para hojas gestionadas.
- `Portada.gs`: estructura, datos e índice dinámico de `0 Portada`.
- `NewCourse.gs`: backup y pasos de Preparar nuevo curso.
- `Utils.gs`: acceso, tamaño, recorte y ordenación de hojas.
- `Sidebar.gs` y `UiSidebar.html`: controles y secciones con icono, subtítulo, viñetas y palabras clave; resumen correcto/total, detalle alternativo y filtrado local sin polling.
- `Ui.gs` y `UiDialog*.html`: diálogos de mantenimiento y flujo único de preparación anual.
- `Branding.gs` y `UiStyles.html`: identidad y estilos comunes.

No se crean capas o abstracciones sin necesidad real.

# 3. Fuentes de verdad

| Dominio | Fuente de verdad | Vista o consumidor |
|---|---|---|
| Configuración general | `_CONFIG` | Portada, tema y UI |
| Versión y esquema | `Config.gs` | `_META` y UI |
| Calendario escolar | `_CAL_TIPOS`, `_CAL_EVALUACIONES`, `_FECHAS`, `_CAL_FECHA_TIPOS` | `1 Calendario` y calendarios de módulo |
| Horario | `_HOR_TRAMOS`, `_HOR_ACTIVIDADES`, `_HOR_SESIONES` | `2 Horario` y sesiones reales de módulo |
| Alumnado | `3 Alumnado` | `6 Eval ...` |
| Configuración de impartición | tabla editable de `4 Config <SIGLA> · <GRUPO>` | calendario propio, `5 Seg ...` y `6 Eval ...` |
| Registro y plan calculado | `_MOD_CONFIG`, `_MOD_PLAN` | identidad estable de Config/Seg/Eval, estado y plan inicial |
| Seguimiento | `5 Seg <SIGLA> · <GRUPO>` | uso docente diario |
| Evaluación | `6 Eval <SIGLA> · <GRUPO>` | calificaciones y Educa |

El nombre de una hoja ayuda a presentar y ordenar, pero no será la única identidad interna de una impartición.

# 4. Estructura técnica actual

```text
_CONFIG
_META
_CAL_TIPOS
_CAL_EVALUACIONES
_FECHAS
_CAL_FECHA_TIPOS
_HOR_TRAMOS
_HOR_ACTIVIDADES
_HOR_SESIONES
_MOD_CONFIG
_MOD_PLAN
```

Todas permanecen ocultas. No existen `_MODULOS`, `_MATRICULAS` ni `_UT`: las UT editables no se duplican en otra tabla técnica.

`_META` se reconstruye desde `Config.gs` y escribe `version_cuaderno` y `version_esquema` como texto literal. La versión no se duplica como constante en otros módulos.

# 5. Portada y hojas visibles

`0 Portada` se genera desde `_CONFIG`. Su índice consulta las hojas visibles existentes, excluye nombres `_...` y crea enlaces por `gid`; por ello incorpora automáticamente `3 Alumnado` y, cuando existan, las familias 4/5/6.

Las hojas generadas usan `ensureSheetSize_()` antes de escribir y `trimSheetToBounds_()` después. `3 Alumnado` conserva un mínimo de filas editables y nunca borra datos en la reparación normal.

`reorderManagedVisibleSheets_()` aplica este orden:

1. `0 Portada`;
2. `1 Calendario`;
3. `2 Horario`;
4. `3 Alumnado`;
5. todas las `4 Config ...`, ordenadas alfabéticamente;
6. todas las `5 Seg ...`, agrupadas por sigla, con activas antes que históricas y sin exigir el mismo grupo;
7. todas las `6 Eval ...`, ordenadas alfabéticamente.

La utilidad mueve solo hojas con nombres gestionados, no borra ni renombra hojas ajenas y conserva el orden relativo de las no gestionadas. Las técnicas continúan ocultas.

# 6. Modelo de calendario

`_CAL_TIPOS` mantiene los IDs `FP1`, `FP2`, `ONLINE` y `CE`, su activación y periodos lectivos, de FEOE y de repaso. Los nombres técnicos históricos de las columnas de FEOE se conservan por compatibilidad. Se relaciona 1:N con `_CAL_EVALUACIONES`.

`_FECHAS` almacena cada evento una sola vez con ID, intervalo, categoría, descripción y prioridad. `_CAL_FECHA_TIPOS` resuelve su relación N:M con tipos: cero relaciones significa evento global. Las categorías admitidas son `FESTIVO`, `REUNION` y `DESTACADO`.

El guardado valida el modelo completo, usa bloqueo de documento, conserva snapshots y escribe en bloque con intento de rollback. Fines de semana, lectividad, finales de evaluación y estadísticas se derivan en código.

`resetCalendarForNewCourse_()` conserva los cuatro tipos estables y la estructura de evaluaciones, pero desactiva tipos, vacía todas sus fechas, elimina eventos y relaciones anteriores y genera propuestas globales para el nuevo curso. Navidad se deriva del par de años académicos y Pascua usa el algoritmo gregoriano de Meeus/Jones/Butcher; no hay consultas de red en ejecución. No se generan puentes o días de centro no verificables.

La precarga de Semana Santa es un único evento `FESTIVO` de Jueves Santo al viernes posterior. `getCalendarConfigForUi_()` combina solo en su respuesta los dos eventos heredados con fechas y ámbito equivalentes; la lectura no escribe nada. Si el docente guarda, el modelo ya unificado reemplaza la pareja en `_FECHAS` y sus relaciones.

`1 Calendario` es una vista idempotente septiembre-junio. Antes de regenerarse limpia notas, formato y reglas del área gestionada. Sin tipos activos sigue dibujando los meses y eventos globales, omite estadísticas y muestra configuración pendiente. Calendario queda cerrado funcionalmente.

# 7. Modelo de Horario

`_HOR_TRAMOS` contiene `tramo_id`, `tipo`, `nombre`, `hora_inicio` y `duracion_minutos`. `nombre` se conserva solo por compatibilidad del esquema 7. La hora final se deriva y los tramos se normalizan en cadena consecutiva.

`_HOR_ACTIVIDADES` contiene `actividad_id`, `categoria`, `nombre`, `sigla`, `tipo_ensenanza_id`, `grupo`, `aula` y `color`. `_HOR_SESIONES` contiene `sesion_id`, `dia_semana`, `tramo_id`, `actividad_id` y `apoyo_sigla`.

`ensureScheduleTechnicalStructure_()` crea o repara las tablas y mantiene la migración idempotente anterior. El configurador solo lee al abrir. El guardado normaliza, valida y persiste antes de renderizar.

`ScheduleView.gs` genera `2 Horario` exclusivamente desde esas tablas. Las fórmulas muestran la semana actual de lunes a viernes y la siguiente durante el fin de semana. El formato condicional destaca con `accent` solo la celda horaria del tramo actual y no altera los fondos de actividades. Horario queda cerrado funcionalmente.

# 8. Identidad de impartición

Una fila de `_HOR_ACTIVIDADES` con `categoria = MODULO` es una impartición. `actividad_id` es su ID estable y se reutilizará en todos los módulos futuros.

Los helpers `getModuleActivities_()`, `getModuleActivityById_()` y `getModuleDisplayName_()` centralizan lectura, resolución y etiqueta sin crear otra entidad.

No existe sincronización entre actividades con la misma sigla. Cada grupo mantiene su Config, Seg y Eval independientes. No se replica una fuente de verdad en `_MODULOS`.

# 9. Modelo de Alumnado

`3 Alumnado` es simultáneamente fuente de datos y superficie editable. Sus columnas visibles son `Apellidos`, `Nombre`, `Grupo`, `Email`, `REACA` y `Medidas`; G guarda `alumno_id` (UUID) oculto y estable.

`createOrRepairStudentsSheet_()`:

- crea o muestra la hoja;
- asegura tamaño suficiente;
- restaura cabeceras, formato, anchos y fila congelada;
- mantiene texto plano para Email;
- preserva el contenido de las filas existentes;
- instala checkbox para REACA, asigna UUID solo a filas con alumno y recorta a siete columnas y a las filas útiles o al mínimo editable.

`isStudentsConfiguredForSidebar_()` realiza una única lectura por bloque y considera válida una fila con Apellidos, Nombre y Grupo. Email no es obligatorio.

No existe matrícula por módulo. Evaluación filtra por coincidencia de Grupo y sincroniza por UUID durante Repair; Seguimiento no lee Alumnado.

# 10. Preparar nuevo curso

`UiDialogNewCourse.html` mantiene los siete pasos en un único diálogo. El paso Seguridad llama a `iniciarPreparacionNuevoCurso()`, que valida la ubicación y ejecuta secuencialmente el backup verificado y la transición anual en una sola llamada. No se ejecuta ninguna mutación al abrir el diálogo. Los pasos posteriores usan `guardarDatosGeneralesNuevoCurso()`, `guardarConfiguracionCalendario()` y `guardarConfiguracionHorario()`. Calendario y Horario se renderizan dentro del diálogo como formularios aislados y devuelven DTO por `postMessage`; el padre controla navegación, validación y guardado. No se encadenan diálogos. Los configuradores individuales conservan sus propios puntos de entrada.

Los datos se separan en reutilizables y anuales. `_CONFIG` conserva profesor, centro y tema; `_HOR_TRAMOS` y `_HOR_ACTIVIDADES` conservan estructura, catálogo e IDs. Alumnado, `_HOR_SESIONES` y todos los valores anuales del Calendario se reinician.

Tras actualizar configuración, `prepareNewCourseAnnualData_()` captura snapshots de Alumnado y de las tablas de Horario y Calendario. En una única transición limpia Alumnado, vacía sesiones y apoyos, reinicia el calendario, precarga propuestas y regenera vistas. Como paso destructivo posterior al backup, materializa y renombra por identidad cada `5 Seg` como OLD, elimina `6 Eval` y `4 Config`, y vacía `_MOD_CONFIG` y `_MOD_PLAN`; nunca decide la identidad por el nombre de pestaña. El backup completo permanece como garantía de la transición anual.

`Reparar estructura` no llama a estas funciones anuales. Por tanto, una reparación conserva datos y no recupera propuestas que el docente haya eliminado.

# 11. Arquitectura de Config, Seg y Eval

## 11.1. Flujo de generación

La creación usa dos fases:

```text
actividad MODULO
  └─ 4 Config <SIGLA> · <GRUPO>
       ├─ 5 Seg <SIGLA> · <GRUPO>
       └─ 6 Eval <SIGLA> · <GRUPO>
```

Config debe existir, conservar su firma aplicada y tener filas en `_MOD_PLAN`. Una sola transacción posterior crea Seg y Eval; preserva la que ya exista y solo crea la ausente.

`4 Config` guarda una asociación verificable con `actividad_id`; las hojas futuras aplicarán el mismo principio sin duplicar campos de `_HOR_ACTIVIDADES`.

## 11.2. `4 Config`

Cruza la actividad con `_HOR_SESIONES`, `_HOR_TRAMOS` y el modelo de Calendario para obtener sesiones reales cronológicas. Su calendario visual parte de la misma estructura base de `1 Calendario`, pero es una representación propia de esa impartición y conserva combinadas las notas escolares y de planificación.

La tabla editable de UT contiene código, nombre, horas manuales, Peso (%), color explícito y evaluación calculada. Sus IDs estables y `evaluation_id` viven en columnas técnicas ocultas de la misma hoja; no existe `_UT`. Las evaluaciones se derivan del último día real asignado a cada UT y proceden de `tipo_ensenanza_id` y `_CAL_EVALUACIONES`. Los totales de horas y la diferencia frente a sesiones disponibles se derivan mediante fórmulas de Sheets. La evaluación visible también usa fórmulas construidas con los cortes acumulados de sesiones reales por evaluación y el separador del locale del libro. El número de sesiones disponibles se escribe como valor estable al crear, recalcular o reparar la hoja.

Config almacena la autoridad sobre:

- definición y orden de UT;
- horas/sesiones previstas;
- asignación UT → evaluación;
- peso UT dentro de su evaluación final;
- peso de cada evaluación en la nota final.

`_MOD_CONFIG` contiene `actividad_id`, `sheet_id`, curso, fecha de creación, firma aplicada, `seg_sheet_id` y `eval_sheet_id`. La migración de esquema 9 a 10 añade idempotentemente las dos últimas columnas. `_MOD_PLAN` contiene una fila por sesión asignada con actividad, curso, fecha, tramo y `ut_id`. Ninguna planificación se deduce de colores.

El recálculo explícito, protegido con bloqueo de documento, valida primero que las horas previstas no superen las sesiones reales disponibles; si hay exceso, aborta sin sustituir plan ni redibujar calendario. Las sesiones reales cruzan Horario y Calendario, excluyen días no lectivos y el periodo de FEOE del tipo de enseñanza. Después distribuye las UT secuencialmente, calcula la evaluación por último día asignado, sustituye solo el plan de la actividad activa y regenera su calendario. Backend y hoja comparten una firma canónica por fila compuesta por posición, `ut_id`, código, nombre, color, horas, evaluación visible y `evaluation_id`; excluye Peso (%) y los pesos finales porque no cambian el calendario. El backend calcula y persiste la firma aplicada desde las celdas tras vaciar la cola de escrituras de fórmulas, incluida la tabla vacía. Fórmulas auxiliares por fila comparan el valor actual con la referencia aplicada y una suma de indicadores alimenta el aviso visible, sin `onEdit`; las fórmulas con varios argumentos usan el separador del locale. Solo los días con varias UT reales reciben el token semántico `theme.colors.mixedDay` y una nota con el desglose de horas; dos sesiones de la misma UT no generan nota de planificación. El defecto deja sesiones sin UT y produce warning.

La hoja `4 Config` es la fuente de verdad de las UT; `_MOD_CONFIG` relaciona `actividad_id`, curso y `sheet_id`, pero no es un backup del contenido editable. Un registro es huérfano solo cuando su `sheet_id` ya no existe, con independencia del nombre actual de la hoja. `cleanupOrphanModuleConfigs_()` se ejecuta dentro del backend de creación y como paso del proceso visible de Reparar, nunca al abrir el configurador. Elimina únicamente las filas huérfanas del registro y las del plan con el mismo `actividad_id` y curso, en bloques contiguos; conserva las cabeceras y los demás datos, y refresca el índice de Portada. Usa bloqueo de documento y snapshots para intentar restaurar ambas tablas si falla la operación. Es idempotente y no forma parte de la limpieza anual. Las UT perdidas con la hoja no se reconstruyen.

`buildRealModuleSessions_()` termina en `fecha_fin` de la última evaluación ordenada del tipo, inclusive, y sigue excluyendo FEOE y días no lectivos. El recálculo valida el exceso de horas antes de escribir la hoja, el plan o la firma aplicada. La tabla inferior combina A:B (UT), C:J (Nombre), K:L (Horas), M:N (Peso %), O:R (Color) y S:U (Evaluación). La migración conserva los datos de los layouts anteriores al recalcular o reparar. El resumen ocupa W:AM: W:AA Evaluación, AB:AC Pendientes, AD:AE Disponibles, AF:AG Peso UTs, AH:AI Peso final y AJ:AM Estado. Agrupa las sesiones reales por intervalo de evaluación para escribir los disponibles estables. Sus fórmulas consumen la suma de horas de UT sobre esas capacidades en orden cronológico, igual que el backend asigna las sesiones: limitan el consumo en cada evaluación intermedia y cargan todo el remanente en la última. La evaluación visible y el `evaluation_id` usan el fin acumulado de cada UT y cortes numéricos de sesiones reales embebidos en la hoja; el exceso conserva la última evaluación configurada. Estas fórmulas se regeneran cuando cambian las sesiones reales. El total pendiente resta todas las horas previstas al total disponible, sin nueva tabla técnica ni cambio de esquema.

Después del saneamiento de huérfanas, Reparar recorre `_MOD_CONFIG` por `sheet_id` y `actividad_id` y actualiza cada hoja existente in-place. Conserva los campos editables y `_MOD_PLAN`; migra las combinaciones, reinstala fórmulas, validaciones, notas, formato condicional y resumen. Solo renueva AP y AR para apuntar al nuevo layout: AQ y la firma aplicada del registro permanecen intactas. La segunda reparación sustituye las mismas fórmulas, notas y reglas, sin duplicarlas ni recalcular la planificación temporal.

M28:M42 guarda los pesos editables de UT y AH29:AH(28+n) los pesos finales editables de las `n` evaluaciones configuradas. `Peso UTs` usa `SUMIFS` por `evaluation_id` oculto en AO y por UT activa (Nombre y Horas positivas); a diferencia del reparto horario, el peso íntegro corresponde a la evaluación final. `COUNTIFS`, `SUMIFS` y fórmulas de Estado calculan los requisitos de 100 %, los vacíos y el estado global. El formato condicional aplica ámbar, verde o rojo sin convertir el color en dato. Recalcular conserva ambos tipos de peso; antes de regenerar el resumen guarda los pesos finales y después los restaura en su mismo rango. `6 Eval` referencia directamente M28:M42 y AH29:AH(28+n) de la `4 Config` vigente, sin copiar sus valores a `_MOD_CONFIG`.

## 11.3. `5 Seg`

`Tracking.gs` cruza las filas vigentes de `_MOD_PLAN` con los `ut_id` de Config y las agrupa por `fecha + UT` conservando la primera aparición diaria. El resultado es un snapshot: las columnas ocultas J:L almacenan código UT, total inicial y color. No hay una hoja técnica de seguimiento ni dependencia de Alumnado.

La hoja visible usa A:H. UT y Actual son entradas, junto con Plan previsto, Actividades realizadas y Mejoras; Fecha, Acum. y Total son derivados. Acum. usa `SUMIF` desde la primera fila hasta la actual por el código seleccionado, por lo que soporta UT intercaladas. Total usa `VLOOKUP` contra el snapshot interno. Las reglas condicionales resuelven color/contraste por UT, exceso en rojo y Mejoras en amarillo sin triggers.

Las reglas de fondo comparan con el código UT real de B y se limitan a tramos de filas de datos, excluyendo separadores combinados. Usan `ROW()` para evaluar cada tramo desde su fila real. Sheets prioriza la primera regla coincidente: para Acum. > Total se genera una regla por UT que combina su fondo del snapshot con texto rojo y negrita, antes de la regla ordinaria de esa UT. Los bordes y alineaciones se reinstalan al crear o reparar.

`reorderManagedVisibleSheets_()` aplica los colores de pestaña al reconocer hojas fijas, registros por `sheet_id` y Seguimientos OLD con estructura reconocible. La política es visual y no modifica hojas ajenas.

Evaluaciones, Navidad, Semana Santa y FEOE se modelan como filas separadoras combinadas independientes. Reparar identifica filas de datos por fecha real y UT, reinstala solo derivados/presentación y nunca vuelve a leer `_MOD_PLAN` para reseedear.

En el cambio de curso se capturan los valores calculados de Acum./Total, se materializan, se eliminan validaciones y reglas dependientes conservando sus formatos efectivos, y la hoja se renombra `OLD AACC` antes de borrar Config. Los OLD quedan fuera del registro activo.

## 11.4. `6 Eval`

`Evaluation.gs` construye la hoja visible desde las UT activas y evaluaciones de Config. Las notas UT y Educa viven únicamente en `6 Eval`; una columna técnica oculta vincula cada fila a `alumno_id`. Las tres filas de cabecera muestran bloques temáticos, columnas y pesos de UT por fórmula directa a M28:M42. Las fórmulas de Media referencian M28:M42 y AH29:AH(28+n) de Config. No existe hoja técnica de notas ni snapshot de pesos.

Repair conserva el `sheet_id` de las hojas vacías 1.6.x y las rellena in-place. En hojas funcionales compara el esquema de columnas antes de escribir; una discrepancia de UT genera aviso y preserva la hoja. Si coincide, migra la tercera fila de cabecera de 1.7.0 mediante inserción, lee valores, fórmulas y Notes por `alumno_id`, sincroniza A:C, añade alumnos y reescribe el bloque ordenado por apellido y nombre. Después reinstala fórmulas derivadas y la fila `MEDIA DEL GRUPO`; las entradas y los ausentes históricos permanecen asociados a su UUID. Si Eval fue borrada, puede recrearla sin tocar Seg. Preparar nuevo curso la elimina tras el backup.

`Protections.gs` usa protecciones de hoja `setWarningOnly(true)` con excepciones de edición para los campos docentes. Una descripción `CUADERNO:<tipo>` identifica las protecciones propias; la instalación actualiza o sustituye únicamente las propias y deja intactas las manuales. Las hojas técnicas, Portada, Calendario, Horario y Seg OLD se protegen completas; Alumnado, Config, Seg y Eval exponen solo sus entradas. El paso de Repair se ejecuta tras reconstruir rangos y es idempotente. Las nuevas Config, Seg y Eval reciben protección al crearse.

# 12. Sidebar y estados

El Sidebar deriva estados desde las fuentes actuales:

- Datos generales: claves mínimas de `_CONFIG`.
- Calendario: modelo configurado y vista disponible.
- Horario: tramos, al menos una asignación semanal y vista disponibles.
- Alumnado: al menos una fila válida.
- Configuración de módulos: por actividad, sin configurar, configurada o con cambios pendientes según registro, hoja y firmas.
- Seguimiento/Evaluación: pendientes o creados según sus `sheet_id` registrados.

No existe una hoja visible de estados. El registro técnico se usa para identidad y el estado se deriva sin polling ni triggers.

# 13. UI, temas y procesos

Las plantillas reciben nombre y versión desde la configuración central. `Theme.gs` inyecta los tokens comunes en Sheets y CSS. Los procesos largos se declaran en servidor y el cliente ejecuta los pasos mediante `google.script.run`.

El modal de creación de Config separa los estados sin módulos, disponible, cargando, error y éxito. El backend devuelve errores funcionales esperados como resultados controlados, registra la traza completa de fallos técnicos y ejecuta rollback de hoja, registro y plan antes de responder.

El controlador transforma el resultado interno de cada paso en un DTO compuesto solo por el número de paso completado, el total y un mensaje de texto. Los objetos de servicios de Apps Script no atraviesan la frontera servidor-cliente.

El botón X del marco nativo no puede bloquearse; por ello cada paso debe ser seguro e idempotente en lo posible. Las confirmaciones se resuelven por identificadores permitidos y reservan `danger` para operaciones destructivas.

# 14. Restricciones vigentes

- Sin triggers instalables.
- Sin People API.
- Sin integración obligatoria con Google Calendar.
- Sin `_MODULOS`, `_MATRICULAS` ni `_UT` anticipados.
- Sin herencia o sincronización automática entre grupos.
- Sin usar colores o nombres de pestaña como identidad única.
- Sin datos personales reales en CP_DEV, GitHub o `clasp`.

# 15. Entornos

`CP_DEV` es el único Spreadsheet sincronizado mediante `clasp` y no contiene datos reales. Los cuadernos de uso docente son copias independientes y quedan fuera del repositorio y del flujo `clasp`.
