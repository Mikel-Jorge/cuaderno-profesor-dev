# Estado del proyecto

**Estado general:** alcance funcional del curso actual cerrado y operativo; las ampliaciones futuras quedan diferidas.

**Última actualización:** 2026-10-13
**Versión vigente:** `1.13.3`
**Esquema vigente:** `14`

## Parche de UX e idempotencia 1.13.3

- Los dos importadores muestran la misma ruta EDUCA. Durante la escritura, el preview y sus acciones desaparecen, el loading ocupa la zona de contenido sin scroll residual y un fallo recupera las selecciones previas.
- Alumnado limpia los bordes horizontales de toda su área preparada antes de dibujar los separadores vigentes, tanto tras ambos importadores como en Repair. El registro de pasos de Repair aprovecha la altura disponible.

## Parche final de cierre 1.13.2

- Menú Alumnado definitivo, importador de Tutoría compacto con validación de todos los Email al pulsar, y ambos importadores compactan y ordenan 3 Alumnado por Grupo → Apellidos → Nombre con separadores. Los alumnos exclusivos de Tutoría permanecen en Alumnado y roster sin matrícula automática.
- Cabecera F de Alumnado: Información / Medidas. Cabecera C de Eval: REACA; Repair distingue la Eval histórica de dos filas de la moderna y no inserta filas en la moderna. Ayuda y documentación actualizadas. Esquema 14.

## Estabilización Tutoría y menú 1.13.1 (histórico)

Las entradas anteriores a 1.13.2 documentan su evolución; los pendientes antiguos no son el estado vigente.

- El menú separa Alumnado (importadores, Matrículas y Contacts) de Módulos (Config, Seguimiento y Evaluación); Tutoría aparece solo con Soy tutor/a activo.
- El ciclo Tutoría desactivada/reactivada elimina primero sus sesiones y después su actividad, limpia el ID gestionado y conserva las demás asignaciones. El modelo de Horario ignora referencias huérfanas a actividades eliminadas sin modificar las hojas al abrir. Si falla la lectura, el diálogo muestra un error claro y permite reintentar o cerrar.
- El importador de Tutoría muestra el preview de Email al acabar el análisis y usa una respuesta final explícita: error académico visible sin cerrar, o importación académica correcta con cierre aunque Contacts falle. El diagnóstico registra solo la etapa, sin datos personales.

## Importador de Tutoría 1.13.0

- Menú condicional para docentes con Tutoría. El XLS real «Por grupo» se procesa mediante un parser OLE/BIFF8 separado del importador OOXML de módulos.
- El análisis no escribe y presenta todo el grupo con Email existente precargado y editable; la importación exige todos los Email válidos, conserva ID/REACA/Medidas y guarda el valor confirmado en 3 Alumnado.
- `_TUT_ALUMNADO` registra el roster anual completo, desactiva ausentes y no modifica `_MATRICULAS`, Config, Seg ni Eval. Repair crea y protege la hoja; el nuevo curso la vacía tras el backup.
- Contacts gestiona la etiqueta general del grupo de Tutoría solo con roster importado, aparte de las etiquetas de módulo. El fallo de People no revierte los datos académicos. Los loading de importación, Matrículas y Contacts quedan dentro del área de contenido.

## Google Contacts y Ayuda 1.12.1

- El diálogo analiza Contacts al abrir, sincroniza con un único clic después del preview y muestra una card final limpia. Los diálogos usan el mismo pie con correo enlazado.
- Solo se gestionan etiquetas `AACC · Grupo · Sigla`. Las etiquetas generales de grupo creadas en 1.12.0 quedan intactas.
- La primera sincronización manual correcta activa `contacts_sync_course` en `_CONFIG`. Matrículas y EDUCA sincronizan después los módulos afectados; un fallo externo no revierte el guardado académico. Sin primera sincronización del curso no hay llamadas automáticas a People API.
- El esquema permanece en 13, Advanced People Service v1 y el permiso `https://www.googleapis.com/auth/contacts` no cambian.

## Flujo EDUCA y matrículas 1.11.4

- EDUCA fija el Grupo de cada MODULO importado y del alumnado reconocido; la validación de Alumnado y las etiquetas de hojas gestionadas se actualizan sin cambiar IDs ni sesiones.
- Las decisiones manuales de matrícula prevalecen sobre reimportaciones. Guardar matrículas o importar sincroniza Eval de inmediato: las bajas conservan notas en filas inactivas protegidas con advertencia y las altas restauran sus controles.
- Alumnado protege cabecera, A:C y G; Email, REACA y Medidas siguen editables. Los diálogos de importación y matrículas se cierran al guardar correctamente. Ayuda y guía describen el nuevo flujo.

## Mapeo y matrículas por módulo 1.11.3

- El menú Módulos muestra primero importación y matrículas. El preview ofrece todos los MODULO, prioriza grupos equivalentes y solo sugiere un destino con nombre completo y grupo inequívocos; los grupos distintos se avisan sin bloquear.
- En módulos gestionados individualmente, las matrículas activas por IDs determinan el alumnado de Eval aunque el Grupo visible difiera. Repair conserva esas relaciones; los módulos antiguos mantienen la selección por Grupo. El gestor incorpora alumnado de grupos equivalentes y relaciones ya registradas, con un estado vacío claro.
- La Ayuda usa términos docentes y explica cómo elegir el módulo cuando EDUCA y el Cuaderno nombran el grupo de modo diferente. Esquema 13 sin cambios.

## Correctivo de descompresión EDUCA 1.11.2

- El `.xls` actual de EDUCA contiene bytes OOXML/ZIP, pero el formulario puede entregarlo con MIME de Excel antiguo. Tras validar firma, directorio y límites, el parser crea en memoria un Blob ZIP con los mismos bytes para descomprimirlo. El parser completo se ha comprobado con el fichero local anonimizado sin incorporarlo al repositorio.

## Correctivo del parser EDUCA 1.11.1

- El informe actual coloca el descriptor de profesor/asignatura después de la cabecera. El parser lo reconoce por su firma semántica tanto antes como después de ella y excluye esa fila administrativa del alumnado. Se mantienen las cabeceras dispersas, la validación estricta y la unión de variantes «(Centro)».

## Importación EDUCA y matrículas 1.11.0

- El informe «Listado mi alumnado» por profesor y asignatura se analiza como OOXML aunque se descargue como `.xls`. Se validan firma, cabeceras, hojas y límites; las variantes finales «(Centro)» se unen por asignatura y grupo. El archivo se revalida al importar y no se guarda en Drive.
- El importador previsualiza destinos MODULO del mismo grupo, altas y bajas. El informe no contiene email: los alumnos nuevos lo dejan vacío y los existentes conservan Email, REACA, Medidas y `alumno_id`.
- `_MATRICULAS` y `_MATRICULAS_META` guardan pertenencia y modo explícito por módulo. Los módulos legacy mantienen selección por Grupo; el gestor manual y la importación activan el modo explícito. Eval usa matrículas y conserva notas de bajas como histórico gris.
- Repair crea y normaliza las tablas técnicas sin convertir módulos legacy. Preparar nuevo curso conserva las matrículas en el backup y las vacía en el cuaderno nuevo. No se añaden scopes ni servicios externos.
- People Directory investigado: el directorio no está disponible para la cuenta docente probada; no se usa como dependencia.

## Correctivos de Tutoría y etiqueta Virtual 1.10.1

- La actividad Tutoría gestionada usa aula Departamento por defecto; las ya existentes con Aula vacía se completan al guardar o reparar, conservando aulas personalizadas.
- El checkbox Soy tutor/a queda alineado con su texto en Preparar nuevo curso y muestra Grupo de tutoría debajo al activarlo.
- El ID técnico `ONLINE` mantiene sus relaciones y se muestra como Virtual. Esquema 12 sin cambios.

## Tutoría base y actividades institucionales 1.10.0

- Datos generales y el asistente anual incluyen Soy tutor/a y Grupo de tutoría libre. Portada y validación de Grupo en Alumnado reflejan la Tutoría activa.
- La actividad Tutoría gestionada conserva `actividad_id` al cambiar grupo. Desactivarla requiere confirmación y elimina solo su actividad y sesiones; el asistente lo aplaza hasta finalizar.
- RD, ECDPI, PPPP y P se proponen una vez por curso, con ID y personalizaciones conservados. GUARDIA y estas categorías no admiten grupo ni tipo de enseñanza; DUAL solo se conserva como legado.
- ONLINE mantiene su ID técnico; desde 1.10.1 se presenta como Virtual. La card de feedback centra el botón sin cambiar su enlace.
- El esquema 12 añade estado de Tutoría y marcador de inicialización de actividades base a `_CONFIG`; no añade hojas ni permisos.

## Canal central de feedback 1.9.2

- Ayuda ofrece, antes del pie de autoría, acceso buscable al formulario externo permanente para errores, propuestas, dudas y comentarios.
- Todas las copias del cuaderno usan el mismo formulario central. No se crean formularios ni hojas de respuestas por copia; no hay permisos ni triggers nuevos.

## Correctivo visual de Preparar nuevo curso 1.8.7

- El selector de carpeta tiene un único desplazamiento en la lista. Un clic selecciona una carpeta; el doble clic la abre. El breadcrumb permite volver a un ancestro y Atrás sube un nivel. La carpeta que se usará aparece junto al footer.
- Resumen conserva las cards y los estados del borrador, con un layout que solo desplaza el contenido cuando no cabe y mantiene el footer visible.
- Pendiente de comprobación visual en CP_DEV: selector con muchas carpetas y Resumen en el modal habitual y en una ventana más baja.

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
- En este hito histórico se anotó una validación visual posterior del asistente.

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

# Alumnado — FUNCIONANDO (resumen histórico; estado vigente arriba)

- Creada `3 Alumnado` como hoja global, visible y editable.
- Columnas visibles: `Apellidos`, `Nombre`, `Grupo`, `Email`, `REACA`, `Información / Medidas`; UUID técnico oculto por alumno.
- Tema, anchos, cabecera congelada, Email en texto y área preparada para pegado.
- Reparación idempotente que conserva las filas de alumnado.
- Estado `Pendiente`/`Configurado` y ayuda contextual en el Sidebar; Email no es obligatorio.
- Preparar nuevo curso limpia los datos del activo después del backup y conserva la estructura.
- Índice dinámico y orden de hojas gestionadas integrados.
- Reparación secuencial corregida: sus respuestas al navegador contienen solo datos serializables y los errores identifican el paso fallido sin dejar el spinner activo.

Validaciones que estaban pendientes en este hito histórico:

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

Validaciones que estaban pendientes en este hito histórico:

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
- En este hito histórico se anotaron comprobaciones posteriores de Eval, ya superadas en versiones siguientes.

# Correctivo 1.7.1

- REACA instala checkbox nativo y normaliza valores booleanos y textos heredados `TRUE`/`FALSE` al reparar.
- Eval usa tema global, cabecera de tres filas con pesos UT en vivo, columna Medidas, notas compactas y Educa siempre amarilla y en negrita.
- Repair ordena por `alumno_id` sin desplazar notas; incorpora `MEDIA DEL GRUPO` con vacíos UT como cero y `MH` como diez solo para promedio Educa.
- Protecciones `CUADERNO:` de solo advertencia en rangos generados; entradas docentes y protecciones externas se conservan.
- En 1.7.1 la validación manual de Eval seguía abierta; quedó superada en versiones posteriores.

# Versión 1.8.0

- Reparar estructura ofrece selección de siete bloques visibles y progreso dinámico; el mantenimiento técnico se ejecuta siempre. Se separan las reparaciones de Config, Seg y Eval y las protecciones de hojas no elegidas se respetan.
- Eval alinea explícitamente nombre y apellidos después de ordenar, integra la cabecera final con el accent del tema y ensancha las dos columnas finales.
- Historial 1.8.0: el asistente explícito de seis pasos usaba los configuradores de datos generales, Calendario y Horario. Fue sustituido por el diálogo único de siete pasos en 1.8.1.
- Menús reordenados, nombre visible Reparar estructura y ayuda ampliada en Sidebar y `USER_GUIDE.md`.
- Abrir los configuradores o Crear configuración de módulo es solo lectura; la creación confirmada sanea Config huérfanas.
- En este hito histórico se anotaron comprobaciones posteriores del asistente y Repair.

# Decisiones vigentes en 1.13.3

- No existe `3 Módulos`.
- No existen `_MODULOS` ni `_UT`; `_MATRICULAS` existe y es la fuente de pertenencia a módulos; `_MOD_CONFIG` y `_MOD_PLAN` no duplican los campos editables de UT.
- Imparticiones con igual sigla y distinto grupo son independientes.
- Las familias 4/5/6 se ordenan agrupadas por tipo; la familia 5 agrupa activos e históricos por sigla independientemente del grupo.
- Las hojas no gestionadas no se borran ni renombran.
- Los colores nunca son fuente de verdad.
- No hay triggers instalables ni integración de Google Calendar. Google Contacts usa Advanced People Service y el scope de contactos.

# Correctivo 1.9.0

- El tema se aplica al guardar a las hojas visibles gestionadas, incluidos los Seg OLD, sin regenerar datos docentes; Apariencia y los diálogos principales se han compactado.
- Calendario limita las fechas especiales a tipos activos, explicita su ámbito en Notes, centra estadísticas y propone finales de junio. Horario limita tipos nuevos a activos, ofrece defaults institucionales y reserva el apoyo para MODULO.
- Alumnado ofrece Grupo desde actividades MODULO. Repair de Eval asigna IDs faltantes a alumnos válidos, mantiene Educa como texto discreto y distingue en gris filas históricas.
- El nuevo curso limpia evaluaciones, deja el histórico en la carpeta original, mueve el activo al destino elegido y rehace los enlaces del índice histórico.

# Correctivo 1.9.1

- Apariencia del configurador individual adopta la distribución compacta del asistente. Calendario abre y enfoca el primer campo inválido o la fecha especial cuyo ámbito falta.
- Horario distingue visualmente el apoyo deshabilitado. Crear configuración muestra un estado vacío compacto cuando no quedan módulos elegibles.
- Reparar Eval conserva Educa como texto discreto al reordenar alumnado: lee su valor visible, prepara las columnas como texto antes de escribir y reinstala después el desplegable. La media del grupo sigue siendo numérica. El esquema permanece en `11`.

# Ampliaciones diferidas

- Google Calendar opcional permanece congelado; no se añaden scopes ni triggers.
- Tutoría avanzada (`7 Tutoría`) solo se considerará si el uso real la justifica. El alcance de un registro avanzado está por definir.

Accesibilidad, rendimiento y pruebas adicionales son mantenimiento, no fases funcionales pendientes.

# Regla de actualización

Este archivo refleja únicamente lo implementado. Los requisitos futuros completos permanecen en `FUNCTIONAL_SPEC.md`.
