<!--
FUENTE DE VERDAD FUNCIONAL DEL PROYECTO

Este documento define el comportamiento esperado del Cuaderno del Profesor.
Si una decisión funcional cambia, debe actualizarse aquí en el mismo commit.
-->

# Cuaderno del Profesor FP Navarra

## Definición funcional del proyecto

**Estado:** especificación funcional vigente
**Versión del documento:** 2.7
**Versión del cuaderno:** `1.5.0`
**Plataforma:** Google Sheets + Google Apps Script + HTML/CSS/JavaScript

# 1. Objetivo y principios

El Cuaderno del Profesor es un libro reutilizable para Formación Profesional que centraliza datos generales, calendario escolar, horario, alumnado, planificación por Unidades de Trabajo (UT), seguimiento y evaluación. No sustituye Moodle, Educa ni Google Calendar.

Principios cerrados:

- una sesión equivale a una hora docente, con independencia de su duración física;
- la unidad funcional de una impartición es `módulo + grupo`;
- los datos gobiernan los colores y nunca al contrario;
- Moodle calcula la nota interna de cada UT y el cuaderno recibe su nota final;
- las recuperaciones se gestionan en Moodle;
- los Resultados de Aprendizaje no son obligatorios en V1;
- no se usan triggers instalables, Google Calendar ni People API en V1;
- se priorizan soluciones simples, mantenibles y con operaciones por bloques.

# 2. Estado funcional de la versión 1.5.0

Están cerrados funcionalmente:

- `0 Portada`;
- `1 Calendario`;
- `2 Horario`.

Alumnado está operativo. `4 Config ...` incluye calendario individual, distribución automática y ponderaciones editables con validación dinámica. `5 Seg ...` y `6 Eval ...` siguen pendientes.

# 3. Estructura del libro

## 3.1. Hojas visibles

La numeración vigente es:

| Orden | Nombre | Función |
|---|---|---|
| 0 | `0 Portada` | Datos generales e índice dinámico |
| 1 | `1 Calendario` | Calendario escolar global |
| 2 | `2 Horario` | Horario semanal del docente |
| 3 | `3 Alumnado` | Entrada global y manual de alumnado |
| 4 | `4 Config <SIGLA> · <GRUPO>` | Configuración independiente de una impartición |
| 5 | `5 Seg <SIGLA> · <GRUPO>` | Seguimiento de una impartición |
| 6 | `6 Eval <SIGLA> · <GRUPO>` | Evaluación de una impartición |

No existe ni se creará una hoja visible `3 Módulos`.

Los nombres 4/5/6 incluyen siempre el grupo, aunque solo exista una impartición con esa sigla. Deben respetar el límite real de nombres de Sheets. Si fuera necesario abreviar, la normalización deberá ser segura y la asociación interna no dependerá únicamente del nombre.

## 3.2. Orden de pestañas

Las hojas gestionadas se agrupan por tipo:

```text
0 Portada
1 Calendario
2 Horario
3 Alumnado
4 Config ACDA · DAM2A
4 Config PMDM · DAM2A
4 Config PMDM · DAM2B
5 Seg ACDA · DAM2A
5 Seg PMDM · DAM2A
5 Seg PMDM · DAM2B
6 Eval ACDA · DAM2A
6 Eval PMDM · DAM2A
6 Eval PMDM · DAM2B
```

Dentro de las familias 4 y 6 se usa orden alfabético estable por nombre, equivalente a `SIGLA + GRUPO`. En la familia 5 se agrupa primero por sigla normalizada, sin exigir coincidencia de grupo; los seguimientos activos preceden a los históricos de la misma sigla y los archivos de varios cursos se mantienen ordenados. No se intercalan Config, Seg y Eval por módulo. Las hojas visibles ajenas al sistema no se borran ni renombran y conservan su orden relativo razonablemente. Las hojas técnicas `_...` permanecen ocultas.

## 3.3. Dimensiones

Toda hoja visible generada amplía el lienzo antes de escribir y lo recorta de forma segura a su área útil. `3 Alumnado`, por ser editable, mantiene un área de entrada razonable y conserva las filas de datos existentes durante una reparación.

# 4. Fuentes funcionales de verdad

- Datos generales y tema: `_CONFIG`.
- Calendario escolar: `_CAL_TIPOS`, `_CAL_EVALUACIONES`, `_FECHAS` y `_CAL_FECHA_TIPOS`.
- Horario: `_HOR_TRAMOS`, `_HOR_ACTIVIDADES` y `_HOR_SESIONES`.
- Alumnado: `3 Alumnado`.
- Configuración de cada impartición: su hoja `4 Config <SIGLA> · <GRUPO>`; `_MOD_CONFIG` registra su identidad y `_MOD_PLAN` su distribución calculada por sesión.
- Seguimiento futuro: su hoja `5 Seg <SIGLA> · <GRUPO>`.
- Evaluación futura: su hoja `6 Eval <SIGLA> · <GRUPO>`.

Los colores son presentación. El nombre de una hoja tampoco debe ser su única identidad.

# 5. Portada

`0 Portada` muestra curso académico, profesor, datos del centro e índice navegable. El curso se propone automáticamente: de agosto a diciembre, año actual-año siguiente; de enero a julio, año anterior-año actual.

El índice se construye desde las hojas visibles existentes y excluye todas las hojas cuyo nombre empieza por `_`. Por tanto, `3 Alumnado` aparece automáticamente y las futuras hojas 4/5/6 aparecerán cuando existan. No se mantiene una lista completa hardcodeada.

# 6. Preparar nuevo curso

La acción solicita confirmación `danger` y crea obligatoriamente una copia del Spreadsheet en su carpeta original, con el nombre original. Si el backup no puede crearse y verificarse, no se ejecuta ninguna mutación posterior.

Después del backup verificado puede mover el cuaderno activo dentro de Mi unidad, renombrarlo como `CuadernoProfesor_XXXX` y actualizar curso, profesor, centro y apariencia. La copia conserva el contenido anterior íntegro.

El cuaderno activo conserva profesor, centro, tema, tramos horarios y catálogo de actividades, incluidos sus IDs estables. Después del backup se reinician de forma coordinada:

- las filas de `3 Alumnado`, conservando hoja y cabecera;
- `_HOR_SESIONES`, incluidos los apoyos, conservando `_HOR_TRAMOS` y `_HOR_ACTIVIDADES`;
- activación y fechas lectivas, prácticas y repaso de `_CAL_TIPOS`;
- fechas finales de `_CAL_EVALUACIONES`, conservando ID, nombre y orden;
- todos los eventos anuales de `_FECHAS` y sus asociaciones en `_CAL_FECHA_TIPOS`.

La transición anual conserva snapshots en memoria para restaurar Alumnado, Horario y Calendario si falla antes de finalizar; el backup verificado sigue siendo la garantía completa. Finalmente regenera Calendario, Horario, Portada, estados, metadatos e índice.

`Inicializar / reparar estructura` nunca aplica esta política anual, no borra datos ni repone festivos eliminados por el docente.

Tras el backup se eliminan las `4 Config ...` gestionadas del curso anterior usando su identidad registrada, junto con sus registros en `_MOD_CONFIG` y `_MOD_PLAN`. Las futuras `6 Eval ...` se eliminarán y las `5 Seg ...` se conservarán como archivo histórico cuando esas familias se implementen.

# 7. Calendario escolar

`1 Calendario` representa septiembre-junio desde el modelo técnico. Los tipos de enseñanza estables son `FP1`, `FP2`, `ONLINE` y `CE`, con periodos lectivos, evaluaciones y, cuando proceda, prácticas y repaso.

Las fechas especiales se almacenan una sola vez y pueden ser globales o aplicarse a tipos concretos. Las categorías vigentes son `FESTIVO`, `REUNION` y `DESTACADO`. Los solapamientos se conservan como datos independientes y la prioridad solo resuelve la presentación. Fines de semana, lectividad, finales de evaluación y estadísticas se derivan sin inspeccionar colores.

La hoja visible es una vista idempotente, compacta, temática y recortada. Guardar la configuración o ejecutar la reparación la regenera desde las tablas técnicas.

Al preparar un curso se precargan como propuestas globales y editables el 12 de octubre, Todos los Santos o su traslado dominical propuesto, 3, 6 y 8 de diciembre y 1 de mayo. No se inventan puentes ni días de libre disposición del centro. Navidad se propone del 24 de diciembre al 6 de enero, ambos incluidos.

Semana Santa se calcula localmente mediante el algoritmo gregoriano de Pascua: Jueves y Viernes Santo forman `Semana Santa`, y de Lunes a Viernes de Pascua forman `Vacaciones de Semana Santa`. No requiere Internet ni fechas fijas de un curso concreto.

Estas fechas aparecen como eventos `FESTIVO` normales en el configurador: pueden modificarse o eliminarse y no se reconstruyen durante una reparación. El docente debe contrastarlas con el calendario oficial de su centro. Aunque aún no haya tipos activos, la vista muestra septiembre-junio, las propuestas y un aviso discreto de configuración pendiente; no muestra estadísticas anteriores. Cada regeneración limpia notas y formatos del área gestionada antes de dibujar el modelo vigente.

Fuentes oficiales contrastadas: [Calendario escolar del Departamento de Educación](https://www.educacion.navarra.es/web/dpto/calendario-escolar), que advierte de variaciones por centro; [normativa anual de elaboración del calendario](https://www.educacion.navarra.es/web/dpto/calendario-escolar/condiciones); y [calendario de días inhábiles de Navarra para 2026](https://www.navarra.es/es/-/nota-prensa/el-gobierno-declara-los-dias-inhabiles-en-navarra-para-2026-a-efectos-de-computo-de-plazos). Por esa variabilidad no se precargan días de libre disposición, fiestas locales ni días adicionales del puente foral.

# 8. Horario del docente

`2 Horario` está funcionalmente cerrado y corregido en 1.4.2.

Los tramos forman una única cadena cronológica consecutiva. Cada tramo tiene ID estable, tipo `SESION` o `DESCANSO`, inicio y duración positiva múltiplo de cinco minutos. La hora final se deriva. Los descansos no admiten actividad ni cuentan como sesión docente.

Las actividades admiten las categorías `MODULO`, `TUTORIA`, `GUARDIA`, `REUNION`, `DUAL`, `PPPP`, `P` y `OTRA`. Las sesiones semanales relacionan día, tramo y actividad; el apoyo es un texto opcional de hasta 40 caracteres asociado a la sesión concreta.

La vista muestra la semana actual de lunes a viernes y, durante sábado y domingo, la semana siguiente. A1 y A2 mantienen el día y la fecha/hora reales. El tramo horario activo resalta solo su celda de hora con fondo `accent`, texto contrastado y negrita; las actividades conservan sus colores y durante el fin de semana no se marca ninguna sesión actual. Es una vista derivada y nunca actúa como fuente de datos.

# 9. Identidad de módulos e imparticiones

Una actividad de `_HOR_ACTIVIDADES` con `categoria = MODULO` ya es el catálogo de imparticiones del docente. Su `actividad_id` es el identificador estable.

No se crea `_MODULOS` ni una segunda entidad que duplique nombre, sigla, grupo, aula, color o tipo de enseñanza.

Dos actividades como `PMDM · DAM2A` y `PMDM · DAM2B` son imparticiones independientes aunque compartan sigla, nombre o programación oficial. No comparten automáticamente configuración, UT, calendario, ponderaciones, evaluación ni seguimiento. No hay herencia, plantillas compartidas ni sincronización; una copia entre grupos será manual y se explicará en la ayuda futura.

# 10. Alumnado

## 10.1. Hoja global editable

`3 Alumnado` es una hoja de entrada manual, no una vista derivada. Sus únicas columnas visibles son, en este orden:

| Apellidos | Nombre | Grupo | Email |
|---|---|---|---|

Debe ser clara, temática, cómoda para pegar datos y con la cabecera congelada. Email admite texto normal y es opcional. No se añaden en V1 DNI, teléfonos, observaciones, identificadores administrativos, estado de matrícula ni otros datos sensibles innecesarios.

`Inicializar / reparar estructura` garantiza la hoja, cabeceras, formato y posición sin borrar filas de alumnado. La operación es idempotente.

## 10.2. Estado en el Sidebar

- `Pendiente`: no existe ninguna fila con Apellidos, Nombre y Grupo informados.
- `Configurado`: existe al menos una fila con esos tres campos.

Email no interviene en el estado. La ayuda explica que el alumnado se introduce una sola vez y que la futura Evaluación lo seleccionará por grupo.

## 10.3. Relación con módulos

En V1 no existe `_MATRICULAS`. `6 Eval <SIGLA> · <GRUPO>` seleccionará inicialmente las filas cuyo Grupo coincida con el grupo de la actividad `MODULO`. Seguimiento no usa alumnado.

Si aparecen casos reales de convalidaciones, bajas, matrícula parcial u otras excepciones, se añadirá entonces una capa explícita de matrícula.

# 11. Configuración de una impartición

## 11.1. Hoja `4 Config`

Cada actividad `MODULO` puede generar independientemente una sola `4 Config <SIGLA> · <GRUPO>`. `_MOD_CONFIG` vincula `actividad_id` con el ID estable de la hoja y el curso; el nombre no basta para validar la asociación. La creación valida tipo, grupo, sesiones semanales, periodo lectivo y evaluaciones. Al abrir el selector solo se eliminan referencias técnicas huérfanas de hojas ya borradas.

El selector muestra solo actividades `MODULO` sin hoja `4 Config` gestionada. Si no queda ninguna actividad elegible, muestra un warning y deshabilita la creación. Durante la creación bloquea nuevas acciones y muestra carga. Un error conserva la selección, informa dentro del modal y elimina los artefactos parciales; el modal solo se cierra automáticamente tras completar correctamente hoja, registro y firma inicial.

La tabla visible es la autoridad sobre las UT y sus ponderaciones. El resumen de la misma hoja es la autoridad sobre los pesos finales de evaluación.

## 11.2. Calendario propio

La hoja reproduce aproximadamente la disposición septiembre-junio de `1 Calendario` y parte del mismo calendario escolar base. La copia visual no es fuente de datos.

Las sesiones reales se obtienen cruzando:

```text
actividad MODULO
+ _HOR_SESIONES
+ _HOR_TRAMOS
+ modelo estructurado del Calendario escolar
```

Cada impartición tiene siempre calendario propio. Dos grupos con el mismo módulo pueden tener días distintos y perder diferente número de sesiones por festivos.

## 11.3. Tabla editable de UT

En la primera fase implementada la tabla contiene:

| UT | Nombre | Color | Horas | Evaluación |
|---|---|---|---:|---|

Desde `1.4.5` el orden visible es:

| UT | Nombre | Horas | Color | Evaluación |
|---|---|---:|---|---|

`Horas` es manual y significa número de sesiones reales. No se deriva del calendario ni convierte minutos físicos a fracciones.

La evaluación visible es calculada, no editable por el docente. Se asigna según la evaluación del último día real planificado para esa UT. Las evaluaciones disponibles proceden del `tipo_ensenanza_id` de la actividad y de `_CAL_EVALUACIONES`. No se duplican nombres de evaluaciones dentro de otro modelo.

Cada UT mantiene un ID interno estable, un orden por fila, un color explícito y una evaluación calculada. Al recalcular se asignan automáticamente código, color, ID y evaluación cuando proceda. La hoja ofrece 15 filas editables de UT.

Desde `1.5.0`, la tabla contiene `UT | Nombre | Horas | Peso (%) | Color | Evaluación`. Peso (%) es editable, admite números de 0 a 100 con decimales y no recibe valor automático. Una UT con Nombre y Horas positivas requiere peso; las filas vacías no lo requieren. El peso completo de cada UT pertenece a la evaluación donde termina, aunque sus horas se distribuyan entre varias evaluaciones.

## 11.4. Totales automáticos

La zona inferior conserva exactamente 15 filas editables con `UT | Nombre | Horas | Peso (%) | Color | Evaluación`. Usa celdas combinadas sin modificar los anchos de los meses. El resumen muestra, por evaluación y para el total, `Pendientes` a la izquierda de `Disponibles`. Las sesiones disponibles son las sesiones reales planificables dentro de cada evaluación; se calculan al crear o recalcular la Config y permanecen estables hasta el siguiente recálculo. Una UT puede consumir sesiones de varias evaluaciones, aunque su Evaluación visible indica dónde termina. Las horas previstas consumen las sesiones disponibles en orden cronológico: el exceso de una evaluación pasa a la siguiente, y solo la última puede tener pendientes negativos. El total pendiente resta todas las horas previstas a la suma de disponibles. Las pendientes y la evaluación se actualizan al editar Horas mediante fórmulas de Sheets, sin trigger ni recálculo manual. El exceso se destaca y Recalcular hace la validación definitiva.

La evaluación visible es una fórmula basada en el fin acumulado de sesiones de cada UT y en el número de sesiones reales hasta cada fecha final de evaluación. La UT queda en la evaluación de su última sesión; si excede la capacidad total, figura en la última evaluación configurada. Las UT de cero horas no reciben evaluación.

El mismo resumen de horas incluye `Peso UTs`, `Peso final` y `Estado`. `Peso UTs` suma los pesos de las UT activas cuya evaluación final coincide; una evaluación sin UT muestra `—` y `Sin UT`, sin exigir 100 %. Una evaluación con UT debe sumar 100 %. `Peso final` es editable de 0 a 100 en cada evaluación, y todas las evaluaciones deben tenerlo configurado y sumar 100 % para completar la ponderación del módulo. El total de `Peso UTs` muestra `—`; el total de `Peso final` muestra su suma y el estado global. Los campos vacíos necesarios aparecen en ámbar, los configurados que cuadran en verde y los importes erróneos en rojo. Las fórmulas y los formatos se actualizan al editar Horas, Peso (%) o Peso final, sin triggers ni Recalcular.

## 11.5. Recálculo explícito

El menú `📚 Módulos → 🔄 Recalcular configuración del módulo`:

1. comprobará la hoja activa;
2. verificará mediante metadatos internos que es una `4 Config` gestionada;
3. resolverá su `actividad_id`;
4. leerá UT y horas;
5. recorrerá cronológicamente las sesiones reales, excluyendo días no lectivos y el periodo de prácticas del tipo de enseñanza de la impartición;
6. asignará exactamente las primeras N sesiones a UT1 y continuará con las siguientes;
7. sustituirá en `_MOD_PLAN` solo las asignaciones de esa impartición;
8. actualizará colores y notas del calendario.

Ejecutarlo desde cualquier otra hoja mostrará un aviso para situarse en una `4 Config ...` y terminará sin modificar nada.

No se usa `onEdit`. Una firma interna de orden, ID, código, nombre, color, horas y evaluación aplicados en el último recálculo se compara mediante fórmulas con los valores actuales. Mientras difieran se muestra `⚠ Hay cambios pendientes de aplicar al calendario`; tras recalcular correctamente, la firma se actualiza y el aviso desaparece.

Los pesos de UT y de evaluación no forman parte de esa firma porque no alteran el calendario. Recalcular conserva todos los pesos exactamente, incluidos los vacíos, y no los distribuye ni los completa.

Las sesiones disponibles se limitan al intervalo desde el inicio lectivo hasta la fecha final inclusiva de la última evaluación configurada para el tipo de enseñanza. Deben ser días lectivos del Horario con tramo `SESION` y `actividad_id` del módulo, sin festivos ni periodo de prácticas. No se asignan UT a repaso, recuperaciones ni fechas posteriores a esa evaluación.

Si una hoja `4 Config` es eliminada manualmente, su configuración se considera perdida. Al abrir Crear configuración, antes de mostrar los módulos, el sistema elimina automáticamente el registro `_MOD_CONFIG` cuyo `sheet_id` ya no existe y solo las filas `_MOD_PLAN` de su `actividad_id` y curso; el módulo queda disponible para crearlo de nuevo sin ejecutar Reparar. El backend repite la comprobación antes de crear y `Inicializar / reparar estructura` usa la misma rutina. Una segunda limpieza no altera el estado. La limpieza no afecta a una hoja existente que se haya renombrado. `_MOD_CONFIG` no recupera UT, nombres, horas ni colores que solo existían en la hoja borrada. Si falla la limpieza técnica, se muestra el error y se detiene la creación.

El recálculo muestra un estado verde cuando todas las sesiones quedan distribuidas sin avisos, ámbar cuando faltan horas o una UT cruza evaluaciones, y rojo ante un error. Mantiene una pantalla de espera durante la ejecución. La Config resalta en ámbar los cambios pendientes de aplicar al calendario y muestra un estado discreto cuando está actualizada.

En el selector de la cuadrícula del Horario, las actividades `MODULO` se muestran como `SIGLA · GRUPO` (o solo sigla si el grupo falta); las demás mantienen `SIGLA · Nombre`. El valor persistido sigue siendo `actividad_id`.

Si las horas previstas superan las sesiones disponibles reales, el recálculo se aborta antes de redibujar o sustituir la planificación. Si faltan horas, las sesiones restantes quedan sin UT y se informa con warning. La planificación persistida contiene exclusivamente asignaciones reales. Si una UT cruza evaluaciones, se informa y su evaluación final se calcula por el último día asignado.

## 11.6. Color por UT y día mixto

Los colores de UT son presentación y se pintan sobre los fondos del calendario base. Si todas las sesiones de una fecha pertenecen a una UT, se usa su color.

Si una fecha contiene varias UT, se usa el color semántico de sistema `DÍA MIXTO` y solo se añade nota cuando hay dos o más sesiones del módulo asignadas a UT distintas, con un texto como:

```text
UT1: 1 h
UT2: 2 h
```

No se parte la celda, no se desplazan UT y se respetan exactamente las horas planificadas.

# 12. Seguimiento futuro

`5 Seg <SIGLA> · <GRUPO>` se crea independientemente cuando existe configuración suficiente. Se genera desde sesiones reales y distribución de UT. No usa ni cruza `3 Alumnado`.

Por defecto hay una fila por día del módulo; si cambia la UT dentro del día puede haber varias filas. La definición vigente de columnas es:

| Columna | Contenido |
|---|---|
| Fecha / sesión | Día de clase |
| Plan previsto | Propuesta de trabajo |
| Actividades realizadas | Registro real |
| Horas actuales | Sesiones realizadas |
| Acumuladas | Sesiones acumuladas de la UT |
| Total | Sesiones previstas de la UT |
| Mejoras | Propuestas de mejora |

Podrán existir columnas técnicas ocultas como `UT_ID`. Acumuladas se calcula automáticamente; si supera Total se resalta. El color de fila procede de la UT como presentación, nunca como dato. Mejoras vacía se muestra neutra y con contenido se destaca.

Una futura replanificación solo podrá afectar sesiones futuras, respetará calendario y horario y nunca alterará registros históricos ya realizados.

Al preparar otro curso, cada seguimiento gestionado se archivará con una marca interna fiable y un nombre reconocible como `5 Seg PMDM · DAM2A OLD 2526`. No se volverá a archivar una hoja ya histórica ni se sustituirán archivos de otros cursos. Antes de eliminar su antigua `4 Config`, las fórmulas que dependan de ella se convertirán en valores cuando sea necesario para evitar `#REF!`, preservando textos, notas, mejoras y presentación.

Los seguimientos `OLD` no cuentan como activos, no impiden crear el seguimiento del nuevo curso, no se recalculan ni se vinculan automáticamente a una actividad actual por compartir sigla. Permanecen en Portada y en la familia 5 aunque el módulo ya no se imparta. Esta política es obligatoria para la futura implementación, pero el archivado efectivo no existe todavía porque tampoco existen las hojas 4/5/6.

# 13. Evaluación futura

`6 Eval <SIGLA> · <GRUPO>` se crea independientemente después de cumplir sus prerrequisitos. Carga inicialmente el alumnado de `3 Alumnado` cuyo Grupo coincide con el de la actividad `MODULO`.

Incluye nombre y apellidos, nota final de cada UT recibida de Moodle, cálculos por evaluación y cálculo final. Las fórmulas deben referenciar robustamente la configuración vigente de `4 Config`; no copian ni congelan pesos, asignaciones UT-evaluación o ponderaciones del curso.

Además incluye columnas manuales independientes para la nota realmente consignada en Educa:

```text
Calculada 1ª | Educa 1ª
Calculada 2ª | Educa 2ª
Calculada 3ª | Educa 3ª
Calculada final | Educa final
```

No se asume que nota calculada y nota Educa coincidan exactamente. Las notas válidas están entre 0 y 10; una UT sin nota se trata como 0. Las recuperaciones continúan en Moodle.

# 14. Generación, estados y ayuda

La creación es independiente por tipo: primero Config y, cuando esté lista, Seg y Eval. Cada acción valida sus prerrequisitos y evita duplicados.

No hay hoja visible de estados. El Sidebar muestra por impartición:

- Configuración: pendiente, configurada o con cambios pendientes de recalcular.
- en el futuro, Seguimiento: pendiente o generado;
- en el futuro, Evaluación: pendiente o generado.

`_MOD_CONFIG` y `_MOD_PLAN` son hojas ocultas y no duplican los valores editables de UT.

La ayuda explica generación de Config, recálculo, horas manuales, cambios pendientes, día mixto, diferencia entre horas previstas y sesiones disponibles e independencia entre grupos. Pesos y diferencia entre nota calculada y nota Educa se añadirán con sus fases correspondientes.

También explicará que los festivos y vacaciones precargados son propuestas editables que deben contrastarse con el calendario del centro, y que un evento eliminado no reaparece durante ese curso. Para los seguimientos históricos explicará la marca `OLD`, su consulta, su inmovilidad, el uso de las mejoras anteriores, su conservación aunque desaparezca el módulo y su ubicación junto a la misma sigla.

# 15. Sidebar, estilo y seguridad

El Sidebar muestra estado real de Datos generales, Calendario, Horario y Alumnado, y el estado por impartición de Configuración: sin configurar, configurada o con cambios pendientes. La ayuda contextual prioriza la hoja activa. La actualización es manual, sin polling ni triggers, y no duplica botones del menú.

La UI usa tema centralizado, branding común, confirmaciones explícitas y progreso para operaciones largas. Las acciones destructivas se identifican con `danger`.

Los diálogos de configuración leen sin crear, reparar, ocultar, reordenar ni regenerar hojas, salvo el saneamiento automático y limitado de Config huérfanas al abrir Crear configuración de módulo. Las demás reparaciones son explícitas y los guardados solo actualizan el modelo afectado y las vistas derivadas necesarias.

La plantilla y el repositorio no contienen datos personales reales. Los cuadernos de uso real no se comparten públicamente.

# 16. Validaciones mínimas

- curso académico y rangos de fechas válidos;
- evaluaciones cronológicamente coherentes;
- tramos horarios coherentes y consecutivos;
- actividad `MODULO`, tipo de enseñanza y grupo válidos;
- en la fase futura de ponderaciones, pesos de UT por evaluación iguales a 100 %;
- en la fase futura de ponderaciones, pesos de evaluaciones en el curso iguales a 100 %;
- horas de UT no negativas;
- notas entre 0 y 10;
- hoja activa y `actividad_id` válidos antes de recalcular o generar.

Los errores se expresan en lenguaje comprensible y no dejan estructuras parciales deliberadamente.

# 17. Flujo anual recomendado

1. Preparar nuevo curso y verificar el backup.
2. Confirmar profesor, centro y tema.
3. Configurar calendario.
4. Configurar horario, incluyendo actividades `MODULO` y grupos.
5. Introducir o pegar `3 Alumnado`.
6. Generar y completar `4 Config` para cada impartición.
7. Recalcular su calendario de UT.
8. Generar `5 Seg` y `6 Eval` cuando sus prerrequisitos estén listos.
9. Usar el cuaderno durante el curso.

No todo debe completarse al principio del curso.

# 18. Prioridad de desarrollo

- Completado: núcleo, Portada, Calendario y Horario.
- Completado: Alumnado y primera fase de Configuración individual de módulo.
- Siguiente: ponderaciones y validación final de `4 Config`.
- Futuro: Seguimiento y Evaluación.
- Posterior: validaciones finales, ayuda ampliada, accesibilidad, rendimiento y pruebas.

# 19. Decisiones cerradas

- No existe `3 Módulos`.
- Cada actividad `MODULO` es una impartición independiente identificada por `actividad_id`.
- No existe configuración automática compartida entre grupos.
- `3 Alumnado` es global y editable.
- No existe matrícula explícita en V1.
- Config, Seg y Eval se agrupan por tipo en las pestañas.
- Cada impartición tiene calendario propio calculado desde sesiones reales.
- Las horas de UT son manuales y equivalen a sesiones.
- El recálculo de UT es explícito y muestra cambios pendientes sin `onEdit`.
- Los días con varias UT usan el estado visual `DÍA MIXTO` y una nota explicativa.
- `4 Config` es autoridad sobre UT y ponderaciones.
- `5 Seg` no utiliza alumnado.
- `6 Eval` selecciona alumnado por grupo y referencia dinámicamente `4 Config`.
- Las notas Educa son manuales e independientes.
- Preparar nuevo curso conserva datos reutilizables y reinicia datos anuales solo después del backup verificado.
- Las futuras hojas 4 y 6 anteriores se eliminan del activo; las hojas 5 se archivan sin referencias rotas.
- Los festivos precargados son propuestas editables y no se reponen mediante reparación.
- Colores y nombres de hojas no son fuentes únicas de verdad.
