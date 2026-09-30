# Arquitectura técnica

**Estado:** vigente
**Última revisión:** 2026-09-30
**Versión:** `1.4.3` / esquema `9`

Este documento describe la arquitectura técnica. El comportamiento esperado se define en `FUNCTIONAL_SPEC.md` y el estado real en `PROJECT_STATUS.md`.

# 1. Plataforma y criterios

- Google Sheets como interfaz principal.
- Google Apps Script V8 vinculado al Spreadsheet.
- HTML/CSS/JavaScript de Apps Script para diálogos y Sidebar.
- `clasp` para sincronización local → Apps Script.
- Git/GitHub como fuente de verdad del código versionado.
- Operaciones por bloques y sin dependencias externas innecesarias.

La lectura de configuradores no crea, repara, oculta, reordena ni renderiza hojas. La reparación estructural es explícita. Un guardado solo persiste el modelo afectado y actualiza sus vistas derivadas necesarias.

Los colores son siempre presentación. Ningún cálculo reconstruye datos desde fondos o estilos.

# 2. Componentes actuales

- `Config.gs`: constantes, nombres de hojas, versión `1.4.3` y esquema `9`.
- `Theme.gs`: tema global, presets y colores semánticos.
- `Main.gs`: menú principal.
- `Setup.gs`: inicialización y reparación idempotente.
- `GeneralConfig.gs`: `_CONFIG` y datos generales.
- `Calendar.gs`: modelo y vista del calendario escolar.
- `Schedule.gs`: modelo, validación, persistencia y consultas de Horario.
- `ScheduleView.gs`: renderizado de `2 Horario`.
- `Students.gs`: estructura, tema, estado y limpieza anual de `3 Alumnado`.
- `ModuleConfig.gs`: registro, creación, calendario, UT y planificación de `4 Config`.
- `Portada.gs`: estructura, datos e índice dinámico de `0 Portada`.
- `NewCourse.gs`: backup y pasos de Preparar nuevo curso.
- `Utils.gs`: acceso, tamaño, recorte y ordenación de hojas.
- `Sidebar.gs` y `UiSidebar.html`: estado y ayuda contextual.
- `Ui.gs` y `UiDialog*.html`: confirmaciones, asistentes y procesos secuenciales.
- `Branding.gs` y `UiStyles.html`: identidad y estilos comunes.

No se crean capas o abstracciones sin necesidad real.

# 3. Fuentes de verdad

| Dominio | Fuente de verdad | Vista o consumidor |
|---|---|---|
| Configuración general | `_CONFIG` | Portada, tema y UI |
| Versión y esquema | `Config.gs` | `_META` y UI |
| Calendario escolar | `_CAL_TIPOS`, `_CAL_EVALUACIONES`, `_FECHAS`, `_CAL_FECHA_TIPOS` | `1 Calendario` y calendarios de módulo |
| Horario | `_HOR_TRAMOS`, `_HOR_ACTIVIDADES`, `_HOR_SESIONES` | `2 Horario` y sesiones reales de módulo |
| Alumnado | `3 Alumnado` | futura `6 Eval ...` |
| Configuración de impartición | tabla editable de `4 Config <SIGLA> · <GRUPO>` | calendario propio y futuros `5 Seg ...` y `6 Eval ...` |
| Registro y plan calculado | `_MOD_CONFIG`, `_MOD_PLAN` | identidad de hoja, estado y futuras hojas `5 Seg ...` |
| Seguimiento | futura `5 Seg <SIGLA> · <GRUPO>` | uso docente diario |
| Evaluación | futura `6 Eval <SIGLA> · <GRUPO>` | cálculo y registro Educa |

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

`_CAL_TIPOS` mantiene los IDs `FP1`, `FP2`, `ONLINE` y `CE`, su activación y periodos lectivos, de prácticas y de repaso. Se relaciona 1:N con `_CAL_EVALUACIONES`.

`_FECHAS` almacena cada evento una sola vez con ID, intervalo, categoría, descripción y prioridad. `_CAL_FECHA_TIPOS` resuelve su relación N:M con tipos: cero relaciones significa evento global. Las categorías admitidas son `FESTIVO`, `REUNION` y `DESTACADO`.

El guardado valida el modelo completo, usa bloqueo de documento, conserva snapshots y escribe en bloque con intento de rollback. Fines de semana, lectividad, finales de evaluación y estadísticas se derivan en código.

`resetCalendarForNewCourse_()` conserva los cuatro tipos estables y la estructura de evaluaciones, pero desactiva tipos, vacía todas sus fechas, elimina eventos y relaciones anteriores y genera propuestas globales para el nuevo curso. Navidad se deriva del par de años académicos y Pascua usa el algoritmo gregoriano de Meeus/Jones/Butcher; no hay consultas de red en ejecución. No se generan puentes o días de centro no verificables.

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

`3 Alumnado` es simultáneamente fuente de datos y superficie editable. Sus columnas estructurales son `Apellidos`, `Nombre`, `Grupo`, `Email`.

`createOrRepairStudentsSheet_()`:

- crea o muestra la hoja;
- asegura tamaño suficiente;
- restaura cabeceras, formato, anchos y fila congelada;
- mantiene texto plano para Email;
- preserva el contenido de las filas existentes;
- recorta a cuatro columnas y a las filas útiles o al mínimo editable.

`isStudentsConfiguredForSidebar_()` realiza una única lectura por bloque y considera válida una fila con Apellidos, Nombre y Grupo. Email no es obligatorio.

No existe matrícula por módulo. La futura Evaluación filtrará por coincidencia de Grupo; Seguimiento no leerá Alumnado.

# 10. Preparar nuevo curso

El proceso UI ejecuta pasos independientes. Primero crea y verifica el backup en la carpeta original. Solo después puede mover, renombrar y modificar el cuaderno activo.

Los datos se separan en reutilizables y anuales. `_CONFIG` conserva profesor, centro y tema; `_HOR_TRAMOS` y `_HOR_ACTIVIDADES` conservan estructura, catálogo e IDs. Alumnado, `_HOR_SESIONES` y todos los valores anuales del Calendario se reinician.

Tras actualizar configuración, `prepareNewCourseAnnualData_()` captura snapshots de Alumnado y de las tablas de Horario y Calendario. En una única transición limpia Alumnado, vacía sesiones y apoyos, reinicia el calendario, precarga propuestas y regenera vistas. Como paso destructivo posterior al backup, elimina por `sheet_id` las `4 Config` registradas y vacía `_MOD_CONFIG` y `_MOD_PLAN`; nunca decide por el nombre de pestaña. Si falla, intenta restaurar los snapshots, la configuración, nombre y ubicación, y declara explícitamente cualquier restauración parcial. El backup completo permanece como garantía.

`Inicializar / reparar estructura` no llama a estas funciones anuales. Por tanto, una reparación conserva datos y no recupera propuestas que el docente haya eliminado.

# 11. Arquitectura de Config y futura de Seg y Eval

## 11.1. Flujo de generación

La creación es independiente por tipo:

```text
actividad MODULO
  └─ 4 Config <SIGLA> · <GRUPO>
       ├─ 5 Seg <SIGLA> · <GRUPO>
       └─ 6 Eval <SIGLA> · <GRUPO>
```

Config debe existir y cumplir sus validaciones antes de generar consumidores. No se crean las tres hojas obligatoriamente a la vez.

`4 Config` guarda una asociación verificable con `actividad_id`; las hojas futuras aplicarán el mismo principio sin duplicar campos de `_HOR_ACTIVIDADES`.

## 11.2. `4 Config`

Cruza la actividad con `_HOR_SESIONES`, `_HOR_TRAMOS` y el modelo de Calendario para obtener sesiones reales cronológicas. Su calendario visual parte de la misma estructura base de `1 Calendario`, pero es una representación propia de esa impartición y conserva combinadas las notas escolares y de planificación.

La tabla editable de UT contiene código, nombre, color explícito, horas manuales y evaluación. Sus IDs estables viven en columnas técnicas ocultas de la misma hoja; no existe `_UT`. Las evaluaciones disponibles se obtienen de `tipo_ensenanza_id` y `_CAL_EVALUACIONES`. Los totales de horas y la diferencia frente a sesiones disponibles se calculan mediante fórmulas. Los pesos quedan para la fase siguiente.

Config almacena la autoridad sobre:

- definición y orden de UT;
- horas/sesiones previstas;
- asignación UT → evaluación;
- en una fase posterior, peso UT dentro de evaluación;
- en una fase posterior, peso evaluación dentro del curso.

`_MOD_CONFIG` contiene `actividad_id`, `sheet_id`, curso, fecha de creación y firma aplicada. `_MOD_PLAN` contiene una fila por sesión asignada con actividad, curso, fecha, tramo y `ut_id`. Ninguna planificación se deduce de colores.

El recálculo explícito, protegido con bloqueo de documento, distribuye las UT secuencialmente, sustituye solo el plan de la actividad activa y regenera su calendario. Una firma de orden, identidad y campos editables, comparada mediante fórmulas y sin `onEdit`, muestra cambios pendientes. Una fecha con más de una UT usa el token semántico `theme.colors.mixedDay` y una nota con el desglose de horas. El exceso no crea fechas y el defecto deja sesiones sin UT.

## 11.3. `5 Seg`

Se genera desde sesiones reales y distribución de UT. No depende de `3 Alumnado`. Mantiene datos de propuesta, realizado, horas actuales, acumulado, total y mejoras. Los colores de UT son presentación.

En el cambio de curso, las `4 Config` ya se eliminan del activo después del backup. Las futuras `6 Eval` aplicarán la misma política. Las `5 Seg` se convertirán en archivos `OLD AACC`, conservarán contenido, notas y aspecto, y materializarán previamente las fórmulas que quedarían rotas. Esta parte continúa pendiente hasta que exista Seguimiento.

## 11.4. `6 Eval`

Selecciona inicialmente alumnos por igualdad entre `3 Alumnado.Grupo` y el grupo de la actividad. Sus fórmulas referencian la configuración vigente de `4 Config`; no copian ponderaciones como valores congelados.

Incluye entradas manuales para nota Educa de cada evaluación y nota Educa final, independientes de los valores calculados.

# 12. Sidebar y estados

El Sidebar deriva estados desde las fuentes actuales:

- Datos generales: claves mínimas de `_CONFIG`.
- Calendario: modelo configurado y vista disponible.
- Horario: tramos, al menos una asignación semanal y vista disponibles.
- Alumnado: al menos una fila válida.
- Configuración de módulos: por actividad, sin configurar, configurada o con cambios pendientes según registro, hoja y firmas.

No existe una hoja visible de estados. El registro técnico se usa para identidad y el estado se deriva sin polling ni triggers.

# 13. UI, temas y procesos

Las plantillas reciben nombre y versión desde la configuración central. `Theme.gs` inyecta los tokens comunes en Sheets y CSS. Los procesos largos se declaran en servidor y el cliente ejecuta los pasos mediante `google.script.run`.

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
