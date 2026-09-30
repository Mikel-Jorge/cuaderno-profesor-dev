# Arquitectura técnica

**Estado:** vigente
**Última revisión:** 2026-09-30
**Versión:** `1.4.0` / esquema `8`

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

- `Config.gs`: constantes, nombres de hojas, versión `1.4.0` y esquema `8`.
- `Theme.gs`: tema global, presets y colores semánticos.
- `Main.gs`: menú principal.
- `Setup.gs`: inicialización y reparación idempotente.
- `GeneralConfig.gs`: `_CONFIG` y datos generales.
- `Calendar.gs`: modelo y vista del calendario escolar.
- `Schedule.gs`: modelo, validación, persistencia y consultas de Horario.
- `ScheduleView.gs`: renderizado de `2 Horario`.
- `Students.gs`: estructura, tema, estado y limpieza anual de `3 Alumnado`.
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
| Calendario escolar | `_CAL_TIPOS`, `_CAL_EVALUACIONES`, `_FECHAS`, `_CAL_FECHA_TIPOS` | `1 Calendario` y futuros calendarios de módulo |
| Horario | `_HOR_TRAMOS`, `_HOR_ACTIVIDADES`, `_HOR_SESIONES` | `2 Horario` y futuras sesiones reales de módulo |
| Alumnado | `3 Alumnado` | futura `6 Eval ...` |
| Configuración de impartición | futura `4 Config <SIGLA> · <GRUPO>` | futuras `5 Seg ...` y `6 Eval ...` |
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
```

Todas permanecen ocultas. No existen `_MODULOS`, `_MATRICULAS` ni `_UT`: no deben crearse anticipadamente.

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
6. todas las `5 Seg ...`, ordenadas alfabéticamente;
7. todas las `6 Eval ...`, ordenadas alfabéticamente.

La utilidad mueve solo hojas con nombres gestionados, no borra ni renombra hojas ajenas y conserva el orden relativo de las no gestionadas. Las técnicas continúan ocultas.

# 6. Modelo de calendario

`_CAL_TIPOS` mantiene los IDs `FP1`, `FP2`, `ONLINE` y `CE`, su activación y periodos lectivos, de prácticas y de repaso. Se relaciona 1:N con `_CAL_EVALUACIONES`.

`_FECHAS` almacena cada evento una sola vez con ID, intervalo, categoría, descripción y prioridad. `_CAL_FECHA_TIPOS` resuelve su relación N:M con tipos: cero relaciones significa evento global. Las categorías admitidas son `FESTIVO`, `REUNION` y `DESTACADO`.

El guardado valida el modelo completo, usa bloqueo de documento, conserva snapshots y escribe en bloque con intento de rollback. Fines de semana, lectividad, finales de evaluación y estadísticas se derivan en código.

`1 Calendario` es una vista idempotente septiembre-junio. Se regenera desde el modelo, aplica tema y recorta su layout. Calendario queda cerrado funcionalmente.

# 7. Modelo de Horario

`_HOR_TRAMOS` contiene `tramo_id`, `tipo`, `nombre`, `hora_inicio` y `duracion_minutos`. `nombre` se conserva solo por compatibilidad del esquema 7. La hora final se deriva y los tramos se normalizan en cadena consecutiva.

`_HOR_ACTIVIDADES` contiene `actividad_id`, `categoria`, `nombre`, `sigla`, `tipo_ensenanza_id`, `grupo`, `aula` y `color`. `_HOR_SESIONES` contiene `sesion_id`, `dia_semana`, `tramo_id`, `actividad_id` y `apoyo_sigla`.

`ensureScheduleTechnicalStructure_()` crea o repara las tablas y mantiene la migración idempotente anterior. El configurador solo lee al abrir. El guardado normaliza, valida y persiste antes de renderizar.

`ScheduleView.gs` genera `2 Horario` exclusivamente desde esas tablas, con semana dinámica, RichText, apoyo, descansos, colores y resaltado actual. Horario queda cerrado funcionalmente.

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

`clearStudentsForNewCourse_()` repara la estructura y limpia únicamente el rango de datos A:D desde la fila 2. La hoja y la cabecera permanecen. Como el backup es anterior, conserva el alumnado del curso previo.

La política de Calendario y Horario no cambia en esta versión. La finalización sincroniza `_META`, oculta hojas técnicas, reordena hojas gestionadas y actualiza el índice.

# 11. Arquitectura futura de Config, Seg y Eval

## 11.1. Flujo de generación

La creación será independiente por tipo:

```text
actividad MODULO
  └─ 4 Config <SIGLA> · <GRUPO>
       ├─ 5 Seg <SIGLA> · <GRUPO>
       └─ 6 Eval <SIGLA> · <GRUPO>
```

Config debe existir y cumplir sus validaciones antes de generar consumidores. No se crean las tres hojas obligatoriamente a la vez.

Cada hoja futura guardará una asociación interna verificable con `actividad_id`. La estrategia concreta se elegirá al implementar Config, sin duplicar campos de `_HOR_ACTIVIDADES`.

## 11.2. `4 Config`

Cruza la actividad con `_HOR_SESIONES`, `_HOR_TRAMOS` y el modelo de Calendario para obtener sesiones reales cronológicas. Su calendario visual parte de la misma estructura base de `1 Calendario`, pero es una representación propia de esa impartición.

La tabla editable de UT contiene código, nombre, color, horas manuales, evaluación y peso dentro de la evaluación. Las evaluaciones disponibles se obtienen de `tipo_ensenanza_id` y `_CAL_EVALUACIONES`. Los totales de horas y los pesos agregados se calculan mediante fórmulas.

Config almacena la autoridad sobre:

- definición y orden de UT;
- horas/sesiones previstas;
- asignación UT → evaluación;
- peso UT dentro de evaluación;
- peso evaluación dentro del curso.

El recálculo explícito distribuye las UT secuencialmente sobre sesiones reales. Una firma interna de último cálculo, comparada mediante fórmulas y sin `onEdit`, muestra cambios pendientes. Una fecha con más de una UT usa el token semántico futuro `mixedDay` y una nota con el desglose de horas.

## 11.3. `5 Seg`

Se genera desde sesiones reales y distribución de UT. No depende de `3 Alumnado`. Mantiene datos de propuesta, realizado, horas actuales, acumulado, total y mejoras. Los colores de UT son presentación.

## 11.4. `6 Eval`

Selecciona inicialmente alumnos por igualdad entre `3 Alumnado.Grupo` y el grupo de la actividad. Sus fórmulas referencian la configuración vigente de `4 Config`; no copian ponderaciones como valores congelados.

Incluye entradas manuales para nota Educa de cada evaluación y nota Educa final, independientes de los valores calculados.

# 12. Sidebar y estados

El Sidebar deriva estados desde las fuentes actuales:

- Datos generales: claves mínimas de `_CONFIG`.
- Calendario: modelo configurado y vista disponible.
- Horario: tramos y vista disponibles.
- Alumnado: al menos una fila válida.
- Configuración de módulos: no disponible hasta su implementación.

No existe una hoja visible de estados. Los futuros estados por actividad podrán persistirse en una hoja técnica solo si surge una necesidad real.

# 13. UI, temas y procesos

Las plantillas reciben nombre y versión desde la configuración central. `Theme.gs` inyecta los tokens comunes en Sheets y CSS. Los procesos largos se declaran en servidor y el cliente ejecuta los pasos mediante `google.script.run`.

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
