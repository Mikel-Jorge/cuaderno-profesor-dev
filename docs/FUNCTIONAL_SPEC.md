<!--
FUENTE DE VERDAD FUNCIONAL DEL PROYECTO

Este documento define el comportamiento esperado del Cuaderno del Profesor.
Si una decisión funcional cambia, debe actualizarse este archivo en el mismo commit
que implemente dicho cambio.

No utilizar AGENTS.md, ARCHITECTURE.md o PROJECT_STATUS.md como sustitutos de esta
especificación.
-->

# Cuaderno del Profesor FP Navarra
## Definición funcional del proyecto

**Estado:** Especificación funcional inicial cerrada  
**Versión del documento:** 1.9
**Plataforma:** Google Sheets + Google Apps Script + HTML/CSS/JavaScript

---

# 1. Objetivo

Crear un **Cuaderno del Profesor reutilizable para Formación Profesional**, inicialmente orientado al trabajo docente en Navarra, construido sobre Google Sheets y automatizado con Google Apps Script.

El cuaderno debe centralizar y facilitar:

- Datos del curso, profesor y centro.
- Calendario escolar.
- Horario semanal.
- Módulos y grupos.
- Alumnado.
- Planificación temporal por Unidades de Trabajo (UT).
- Seguimiento diario.
- Sesiones previstas y realizadas.
- Evaluación por UT y por evaluaciones.
- Nota finalmente consignada en Educa.
- Exportación de contactos mediante CSV.
- Ayuda y configuración mediante panel lateral.

No pretende sustituir Moodle, Educa ni Google Calendar. Su objetivo es ser un **cuaderno docente práctico, visual, rápido de consultar y suficientemente automatizado para eliminar trabajo repetitivo**.

# 2. Principios de diseño

1. **Simplicidad:** el docente no debe conocer Apps Script.
2. **Automatizar sin quitar control:** calendarios, acumulados, medias, estadísticas y colores se calculan automáticamente, pero el docente puede corregir datos.
3. **Los datos gobiernan los colores:** el color representa un estado; nunca se usa el color como fuente principal del dato.
4. **1 sesión = 1 hora docente:** aunque físicamente dure 55 minutos u otra duración.
5. **Un archivo por curso académico:** cada curso se trabaja sobre una copia nueva.
6. **Impartición = módulo + grupo:** por ejemplo, `PMDM + DAM2A`.
7. **Primero utilidad y robustez; después automatizaciones avanzadas.**

# 3. Estructura del libro

## 3.1. Pestañas visibles

| Prefijo | Pestaña | Función |
|---|---|---|
| 0 | Portada | Información general e índice |
| 1 | Calendario | Calendario escolar global |
| 2 | Horario | Horario semanal |
| 3 | Módulos | Resumen de módulos e imparticiones |
| 4 | Alumnado | Listado general |
| 5 | Calendario - módulo - grupo | Planificación temporal |
| 6 | Seguimiento - módulo - grupo | Seguimiento diario |
| 7 | Evaluación - módulo - grupo | Calificaciones |

Ejemplos:

```text
5 Calendario - PMDM - DAM2A
6 Seguimiento - PMDM - DAM2A
7 Evaluación - PMDM - DAM2A
```

## 3.2. Pestañas técnicas

Conjunto inicial:

```text
_CONFIG
_FECHAS
_TRAMOS
_MODULOS
_MATRICULAS
_UT
_META
```

Estas hojas estarán ocultas normalmente, podrán protegerse y podrán desocultarse para mantenimiento. El usuario habitual trabajará desde paneles, menús y zonas editables.

## 3.3. Dimensiones de las hojas visibles

Todas las hojas visibles generadas por el sistema se ajustarán a su área útil, sin filas ni columnas vacías posteriores al layout. Los generadores podrán ampliar de nuevo la hoja antes de añadir contenido y la recortarán al terminar, por lo que las dimensiones no serán permanentes.

# 4. Menú principal

```text
📘 Cuaderno del Profesor 📘
├── Abrir panel / Ayuda
├── 🆕 Preparar nuevo curso
├── Configuración
│   ├── 👤 Datos generales
│   ├── Fechas y calendario
│   ├── Tramos horarios
│   └── Módulos y grupos
├── Módulos
│   ├── Crear calendario de módulo
│   ├── Crear seguimiento de módulo
│   └── Crear evaluación de módulo
├── Alumnado
│   └── Crear CSV para Google Contacts
└── Acerca de / Versión
```

Google Calendar, People API y sincronizaciones avanzadas quedan fuera de la V1.

El menú y sus acciones utilizarán un icono funcional únicamente cuando facilite su identificación rápida. Las etiquetas iniciales serán `🆕 Preparar nuevo curso`, `🔄 Inicializar / reparar estructura` y `❓ Ayuda`, manteniendo el mismo icono en el título nativo del diálogo asociado.

Las acciones sensibles solicitarán confirmación expresa antes de ejecutarse. Las operaciones destructivas utilizarán una confirmación destacada en rojo y explicarán claramente su efecto. Las acciones que puedan tardar varios segundos continuarán después en un diálogo de progreso común.

La opción inicial `Inicializar / reparar estructura` mostrará una confirmación no destructiva antes de abrir el diálogo de progreso. Cancelar no iniciará ningún paso; continuar mostrará los estados relevantes, el resultado final y cualquier error producido.


# 5. Portada

**Nombre:** `0 Portada`

Debe mostrar:

```text
CUADERNO DEL PROFESOR
Curso académico
Nombre y apellidos del docente
Correo del profesor
Centro
Dirección
Teléfono
Correo del centro
Web del centro
```

## 5.1. Curso académico automático

Regla por defecto:

```text
1 agosto - 31 diciembre  → año actual - año siguiente
1 enero - 31 julio       → año anterior - año actual
```

Ejemplo:

```text
21/09/2026 → 2026-2027
```

La propuesta podrá corregirse manualmente.

## 5.2. Datos generales y apariencia

La configuración general permitirá editar los datos del profesor y del centro, aunque algunos campos permanezcan vacíos. El correo del profesor y el correo del centro se mostrarán como enlaces `mailto:` en la Portada cuando tengan valor. La web del centro podrá introducirse como dominio, con o sin `www`, y el sistema añadirá `https://` cuando no se haya indicado protocolo.

El mismo diálogo permitirá seleccionar el tema visual activo y personalizar sus colores principales. El botón `Guardar` permanecerá visible y estará deshabilitado sin cambios o durante el guardado. Tras guardar correctamente, el diálogo se cerrará automáticamente; si se produce un error, permanecerá abierto, conservará los valores introducidos y permitirá reintentar.

## 5.3. Índice dinámico

A la derecha habrá un índice visual y clicable construido a partir de las hojas visibles existentes:

```text
0 · Portada
1 · Calendario
2 · Horario
3 · Módulos
4 · Alumnado

5 · Calendario - PMDM - DAM2A
6 · Seguimiento - PMDM - DAM2A
7 · Evaluación - PMDM - DAM2A
```

No se mostrarán hojas técnicas cuyo nombre comience por `_`. Al generar nuevas hojas, el índice se actualizará y cada entrada permitirá navegar a la pestaña correspondiente.

# 6. Preparar nuevo curso

La acción principal será **Preparar nuevo curso**.

## 6.1. Aviso inicial

El primer popup utilizará la confirmación común `danger` y mostrará una advertencia clara:

```text
ATENCIÓN

Esta operación prepara el cuaderno para un nuevo curso académico y puede
sustituir información del curso actual cuando existan datos específicos
del curso.

¿Deseas continuar?
```

No se realizará ninguna acción destructiva sin confirmación expresa.

## 6.2. Copia de seguridad

El resumen ofrecerá crear una copia de seguridad antes de aplicar cambios y la opción estará activada por defecto. Si se mantiene activada, se copiará el Spreadsheet mediante `DriveApp` en la carpeta original y con un nombre que incluya el curso y la fecha. La copia siempre precederá al movimiento y a cualquier modificación del cuaderno. Si la carpeta no puede determinarse, la copia falla o no puede verificarse, el proceso se detendrá sin mover el archivo ni aplicar cambios posteriores. El usuario podrá desactivar expresamente la copia.

## 6.3. Ubicación del cuaderno

El usuario podrá mantener el cuaderno en su carpeta actual, que será el comportamiento por defecto, o elegir otra carpeta de `Mi unidad` mediante un navegador propio. El selector mostrará sólo carpetas, permitirá entrar en subcarpetas, volver a la carpeta superior, consultar la ruta actual, cancelar sin alterar la selección y usar la carpeta abierta como destino. No mostrará IDs técnicos ni permitirá crear, renombrar o eliminar carpetas.

Si se elige otro destino, el backup permanecerá en la carpeta original y el archivo activo se moverá mediante `File.moveTo()` antes de actualizar la configuración. Si el movimiento falla, no se modificará la configuración. Si una modificación posterior falla, se intentará restaurar la configuración y devolver el archivo a la carpeta original, conservando siempre el backup.

El alcance inicial se limita a carpetas de `Mi unidad` accesibles mediante `DriveApp`. No se garantiza soporte completo para Unidades compartidas.

## 6.4. Asistente breve

La primera implementación contiene únicamente pasos correspondientes a funciones disponibles:

```text
1. Curso académico
2. Profesor y centro
3. Apariencia
4. Ubicación del cuaderno
5. Resumen
```

El curso propuesto seguirá la regla automática existente y podrá coincidir con el curso actual. Profesor, centro y apariencia se cargarán con sus valores actuales para conservarlos salvo edición expresa. El resumen indicará que sólo se actualizarán los datos generales, la Portada, el índice y los metadatos.

Calendario, tipos de enseñanza, tramos horarios, módulos, horario, alumnado y programación de UT se incorporarán a este mismo asistente cuando esas áreas existan. No se mostrarán como pasos ni se crearán hojas vacías mientras no estén implementados.

## 6.5. Conservación de datos

La primera implementación conserva y permite editar directamente:

- Profesor.
- Datos del centro.
- Preferencias visuales.
- Colores.

Cuando existan esas áreas, el asistente podrá proponer conservar también:

- Tramos horarios.
- Catálogo de módulos, si interesa.

Ejemplo:

```text
Actualmente utilizas estos datos del centro.
¿Son correctos?
```

Los datos se muestran prellenados y se mantienen sin una batería de preguntas campo por campo. La primera implementación no borra hojas técnicas ni datos arbitrarios.


# 7. Calendario escolar

**Nombre:** `1 Calendario`

## 7.1. Enfoque

Existirá **un único calendario anual**. No habrá una pestaña separada para 1º, 2º, Online o Especialización.

Tipos contemplados:

```text
1º
2º
Online
Curso de especialización
```

Solo se activarán los necesarios cada año.

## 7.2. Fechas configurables

Para cada tipo activo:

- Inicio de curso.
- Fin de curso.
- Fecha final de 1ª evaluación.
- Fecha final de 2ª evaluación.
- Fecha final de 3ª evaluación, si procede.
- Inicio de prácticas.
- Fin de prácticas.
- Inicio de repaso.
- Fin de repaso.

También podrán definirse:

- Festivos.
- Navidad.
- Otros periodos vacacionales.
- Días no lectivos.
- Fechas destacadas.
- Reuniones, si se usan.
- Otros eventos simples.

## 7.3. `_FECHAS`

Se usará una tabla sencilla. Como referencia funcional:

```text
Tipo
Ámbito
Fecha inicio
Fecha fin
Descripción
Color
```

Para eventos de un día:

```text
Fecha inicio = Fecha fin
```

Se evitarán columnas innecesarias.

## 7.4. Conflictos visuales

Si una fecha tiene más de un significado:

> Se mostrará visualmente el primero que corresponda según el orden/prioridad definido.

No se añadirán iconos, subdivisiones ni indicadores secundarios en V1.

## 7.5. Colores

Serán configurables. Preferentemente tonos pastel para contenido.

Tipos posibles:

- Festivo.
- Vacaciones.
- Evaluación.
- Prácticas.
- Repaso.
- Fecha destacada.
- Reunión.
- Día actual.

## 7.6. Color del mes

El color del encabezado del mes será el correspondiente a la evaluación a la que pertenezca el **día 1 de ese mes**.

Es una referencia visual orientativa aunque otros tipos de enseñanza tengan otra evaluación en esas fechas.

## 7.7. Hoy y días pasados

**Hoy:**
- Fondo sólido configurable.
- Azul turquesa por defecto.
- Negrita.

**Días anteriores a hoy:**
- Texto tachado.

## 7.8. Estadísticas

Por cada tipo de enseñanza activo:

- Días lectivos por evaluación.
- Días lectivos totales.
- Días lectivos transcurridos.
- Días lectivos restantes.
- Días desde el inicio de clases.
- Días hasta final de curso.
- Días hasta el final de la evaluación actual.

Se excluirán fines de semana no lectivos, festivos, vacaciones y días expresamente no lectivos.


# 8. Horario del docente

**Nombre:** `2 Horario`

## 8.1. Cabecera

```text
A1 → día actual: LUNES, MARTES...
A2 → fecha y hora actual
```

Las cabeceras diarias mostrarán:

```text
Lunes 21 sep
Martes 22 sep
Miércoles 23 sep
...
```

## 8.2. Tramos horarios

Serán configurables y podrán incluir:

- Mañana.
- Tarde.
- Recreos.
- Pausas.
- Reuniones.

Ejemplo actual:

```text
08:10
09:05
10:00
10:55-11:25 recreo
11:25
12:20
13:15
14:10
...
```

Al preparar un nuevo curso se preguntará si se desean conservar.

## 8.3. Actividades del horario

Podrá contener:

```text
Módulos
Tutoría
Coordinación
Guardia
Reunión
Trabajo presencial
Dual
PPPP
Otras funciones
```

Cada actividad podrá tener:

- Sigla.
- Grupo.
- Aula.
- Color.

Ejemplo:

```text
PMDM
DAM2A
A17
```

## 8.4. Apoyo docente

El apoyo se configurará por sesión concreta.

Visualmente podrá mostrarse una marca pequeña como:

```text
AP
```

## 8.5. Hora actual

La sesión actual se resaltará temporalmente con el color general de “ahora”, sin cambiar permanentemente el color propio del módulo.


# 9. Módulos

**Nombre:** `3 Módulos`

Será el resumen visible de las imparticiones. La estructura técnica residirá en `_MODULOS`.

Cada impartición podrá incluir:

- Nombre completo.
- Siglas del módulo.
- Ciclo.
- Siglas del ciclo.
- Tipo de enseñanza.
- Curso.
- Grupo.
- Grado medio/superior/especialización.
- Sesiones semanales.
- Total normativo de sesiones/horas.
- Aula principal.
- Existencia de apoyo.
- Color.

Un mismo módulo podrá existir en varios grupos y cada combinación será independiente.

## 9.1. Sesiones disponibles

A partir de calendario + horario se calcularán:

- Sesiones 1ª evaluación.
- Sesiones 2ª evaluación.
- Sesiones 3ª evaluación.
- Sesiones totales.
- Porcentaje de sesiones disponibles sobre el total normativo.

A efectos del cuaderno:

> 1 sesión = 1 hora.


# 10. Alumnado y matrícula

## 10.1. Alumnado

**Nombre:** `4 Alumnado`

Columnas estructurales mínimas:

- Grupo.
- Nombre.
- Apellidos.
- Email.

El docente podrá añadir columnas propias sin alterar las columnas estructurales.

El listado podrá pegarse o importarse desde Educa.

No será necesario disponer del alumnado al crear inicialmente el cuaderno.

## 10.2. Matrícula por módulo

Pertenecer a un grupo no implica cursar todos los módulos.

Casos:

- Repetidores.
- Convalidados.
- Módulos ya superados.
- Matrícula parcial.

Por defecto:

> Todo alumno del grupo se considera matriculado en los módulos de ese grupo.

Después se podrán desmarcar excepciones en `_MATRICULAS` o desde una interfaz sencilla.

Esto evita borrar manualmente alumnos de las hojas de evaluación.

# 11. Google Contacts

La V1 utilizará **CSV**.

El sistema podrá generar etiquetas por grupo:

```text
Alum_DAM2A
Alum_DAM2B
Alum_ASIR2
```

Se valorará opcionalmente añadir el curso académico al nombre.

Un único proceso podrá preparar todos los grupos.

La People API queda como mejora futura.


# 12. Calendario de módulo

Se crea desde:

```text
Cuaderno del profesor
→ Módulos
→ Crear calendario de módulo
```

Primero se selecciona grupo y después un módulo disponible para ese grupo.

Ejemplo:

```text
Grupo: DAM2A
Módulo: PMDM
```

Nombre:

```text
5 Calendario - PMDM - DAM2A
```

Se generará usando:

- Calendario escolar.
- Tipo de enseñanza.
- Inicio y fin del curso correspondiente.
- Evaluaciones.
- Festivos.
- Vacaciones.
- Prácticas.
- Horario semanal de esa impartición.

# 13. Unidades de Trabajo

Cada calendario de módulo tendrá una tabla de UT.

Ejemplo:

```text
UT1 | Almacenamiento de la información
UT2 | Bases de datos relacionales
UT3 | Entidades y relaciones
```

Datos mínimos:

- Código.
- Descripción.
- Sesiones previstas.
- Color.

Se propondrá una paleta pastel. Los colores podrán repetirse, evitando en lo posible dos UT consecutivas con el mismo color.

## 13.1. Distribución automática

Ejemplo:

```text
PMDM:
Lunes   2 sesiones
Martes  1 sesión
Viernes 2 sesiones

UT1 = 5 sesiones
```

Resultado:

```text
Lunes   → 2 UT1
Martes  → 1 UT1
Viernes → 2 UT1
```

## 13.2. Planificación interna por sesión

Siempre se planificará internamente por sesión.

Si un viernes:

```text
Sesión 1 → UT1
Sesión 2 → UT2
```

el calendario visual del día utilizará el color de la **primera UT**.

No se dividirán celdas en V1.


# 14. Prácticas y repaso

Durante prácticas, las sesiones ordinarias del módulo quedarán excluidas de la planificación normal.

Se permitirá registrar sesiones de repaso durante prácticas.

Estas sesiones podrán:

- Aparecer en seguimiento.
- Identificarse como repaso.
- Contabilizarse como realizadas si el docente así lo considera.

# 15. Estadísticas del calendario de módulo

Se mostrarán:

- Sesiones por evaluación.
- Sesiones totales.
- Sesiones previstas por UT.
- Porcentaje de cada UT sobre el total.
- Porcentaje de cada UT dentro de su evaluación cuando proceda.
- Porcentaje disponible respecto al total normativo.

# 16. Configuración de evaluación del módulo

Podrá hacerse después de haber iniciado el curso.

## 16.1. V1 centrada en UT

Los RA quedan fuera de la primera versión.

## 16.2. Pesos por evaluación

Ejemplo:

```text
1ª evaluación
UT1 → 20 %
UT2 → 60 %
UT3 → 20 %
```

La suma debe ser 100 %.

## 16.3. Junio

Ejemplo:

```text
1ª evaluación → 30 %
2ª evaluación → 30 %
3ª evaluación → 40 %
```

La suma debe ser 100 %.

## 16.4. Instrumentos dentro de UT

Se podrá guardar información como:

```text
Examen   60 %
Proyecto 40 %
```

pero será informativa.

La nota final de la UT se obtiene de Moodle y se introduce directamente en el cuaderno.


# 17. Seguimiento de módulo

Se crea desde:

```text
Cuaderno del profesor
→ Módulos
→ Crear seguimiento de módulo
```

Selección:

```text
Grupo
↓
Módulo
```

Nombre:

```text
6 Seguimiento - PMDM - DAM2A
```

## 17.1. Filas

Por defecto habrá una fila por día en que se imparte el módulo:

```text
14/09 → 2 sesiones
15/09 → 1 sesión
18/09 → 2 sesiones
```

Si un mismo día cambia de UT, podrá haber dos filas:

```text
18/09 | UT1 | 1 sesión
18/09 | UT2 | 1 sesión
```

## 17.2. Columnas visibles

| Columna | Contenido |
|---|---|
| Fecha / sesión | Día de clase |
| Plan previsto | Propuesta de trabajo |
| Actividades realizadas | Registro real |
| Horas actuales | Sesiones realizadas |
| Acumuladas | Sesiones acumuladas de la UT |
| Total | Sesiones previstas de la UT |
| Mejoras | Propuestas de mejora |

Podrán existir columnas técnicas ocultas como `UT_ID`.

## 17.3. Acumulados

Ejemplo:

```text
UT1 total previsto = 5

14/09 → 2 → acumulado 2
15/09 → 1 → acumulado 3
18/09 → 2 → acumulado 5
```

El docente modifica `Horas actuales`.

`Acumuladas` se calcula automáticamente.

Si:

```text
Acumulado > Total
```

el acumulado aparecerá en rojo.

## 17.4. Colores

Las filas tomarán automáticamente el color de la UT asignada.

Nunca se deducirá la UT a partir del color.

## 17.5. Mejoras

```text
Vacía         → blanco
Con contenido → amarillo pastel
```


# 18. Replanificación automática del seguimiento

La planificación futura podrá desplazarse cuando una UT se alargue o se acorte.

## 18.1. Retraso

```text
UT1 prevista: 5 sesiones
UT1 real:     6 sesiones
```

Resultado:

> UT2, UT3, UT4... avanzan una sesión hacia adelante.

## 18.2. Adelanto

```text
UT1 prevista: 5 sesiones
UT1 real:     4 sesiones
```

Resultado:

> UT2, UT3, UT4... se adelantan una sesión.

## 18.3. Regla

La replanificación afecta únicamente al futuro.

No se modificarán automáticamente:

- Fechas ya realizadas.
- Actividades ya registradas.
- Mejoras.
- Información histórica consolidada.

La planificación futura seguirá respetando:

- Orden de UT.
- Sesiones pendientes.
- Calendario lectivo.
- Horario.
- Festivos.
- Vacaciones.
- Prácticas.
- Repasos.

La implementación deberá evitar replanificaciones destructivas.

# 19. Cambios tardíos de calendario

La V1 asumirá que las fechas principales se definen correctamente antes de generar calendarios y seguimientos.

Modificar `_FECHAS` actualizará el calendario general y sus estadísticas.

No será obligatorio en V1 reconstruir automáticamente hojas de seguimiento ya utilizadas durante meses.

Una sincronización estructural avanzada queda para fases futuras.


# 20. Evaluación de módulo

Se crea desde:

```text
Cuaderno del profesor
→ Módulos
→ Crear evaluación de módulo
```

Nombre:

```text
7 Evaluación - PMDM - DAM2A
```

## 20.1. Alumnado

Se cargará automáticamente el alumnado matriculado en esa impartición.

Si aún no existe matrícula específica, inicialmente podrá cargarse todo el grupo.

## 20.2. Información

Como mínimo:

- Nombre y apellidos.
- Causa/necesidad educativa.
- Medidas o consideraciones.
- Nota de cada UT.
- Media de cada evaluación.
- Nota Educa de cada evaluación.
- Media final de junio.
- Nota Educa final.

## 20.3. Necesidades educativas

Se podrán registrar de forma breve:

```text
Causa:
TDAH

Medidas:
Más tiempo en pruebas
Instrucciones fragmentadas
Seguimiento frecuente
```

El cuaderno será privado y de uso docente dentro del centro.

# 21. Notas

La nota de cada UT procede de Moodle.

No se duplicará el cálculo de tareas, proyectos o exámenes.

## 21.1. Sin nota

Por simplicidad:

> Una UT sin nota se tratará como 0.

Las celdas podrán inicializarse en 0.

## 21.2. Colores

| Nota | Color |
|---|---|
| 0 | Rojo intenso |
| 0,01 - 4,99 | Rojo pastel |
| 5,00 - 5,99 | Naranja pastel |
| 6,00 - 6,99 | Azul pastel |
| 7,00 - 8,99 | Verde pastel |
| 9,00 - 10,00 | Amarillo pastel |

Se incluye el 9 en el último tramo para evitar un valor sin formato.

## 21.3. Media

Las medias se calcularán automáticamente con los pesos de UT configurados.

## 21.4. Nota Educa

Será independiente y manual.

Ejemplo:

```text
Media automática: 5,73
Nota Educa:       6
```

## 21.5. Junio

La media final se calculará según los pesos configurados entre evaluaciones.

También existirá un campo manual de nota Educa final.

## 21.6. Recuperaciones

Se gestionan en Moodle.

El cuaderno solo recibe la nota vigente/final de la UT.


# 22. Panel lateral

Será una pieza central de ayuda y estado. La opción `❓ Ayuda` del menú abrirá el panel sin iniciar procesos ni modificar datos.

## 22.1. Estado

La primera versión mostrará el estado real de estas áreas:

```text
Datos generales
Calendario
Horario
Módulos
Alumnado
```

Los datos generales se considerarán completos cuando existan curso académico, profesor y centro. Las áreas todavía no implementadas se identificarán como no disponibles y nunca se presentarán como completadas.

## 22.2. ❓ Ayuda colapsable

La primera versión incluirá únicamente apartados relacionados con funciones disponibles:

```text
Primeros pasos
Portada
Datos generales
Preparar nuevo curso
Inicializar / reparar
Temas y apariencia
Problemas frecuentes
```

La ayuda será breve y clara. Se ampliará cuando se incorporen nuevas funciones, sin mostrar previamente apartados vacíos.

## 22.3. Ayuda contextual

El panel detectará la hoja activa y priorizará la ayuda relacionada cuando exista. En `0 Portada`, el apartado Portada aparecerá primero y abierto.

## 22.4. Actualización

El panel no duplicará acciones del menú principal. Incluirá una actualización manual del estado y del contexto, sin sondeo periódico ni triggers instalables.

# 23. Estilo visual

Principios:

- Pasteles para contenido.
- Colores más sólidos para títulos.
- Turquesa por defecto para “hoy/ahora”.
- Amarillo pastel reservado preferentemente para mejoras.
- Rojo intenso para nota 0 y avisos críticos.
- Alternancia visual de UT.

Los colores generales se centralizarán en una configuración global de tema y no se repartirán como valores independientes entre funcionalidades.

## 23.1. Temas visuales

El cuaderno dispondrá de tokens comunes para color principal, secundario, acento, fondo, superficie, texto, tono neutro, borde, éxito, advertencia y peligro. La Portada, los diálogos y las futuras hojas consumirán esta fuente común cuando corresponda.

Los presets utilizarán siempre fondo y superficie claros con texto oscuro; cambiarán la identidad cromática, no el modo claro/oscuro del cromo de Google. Se ofrecerán `Océano`, `Turquesa naranja`, `Verde natural`, `Coral menta`, `Burdeos lavanda` y `Azul clásico`, con `Océano` como valor inicial. El usuario podrá personalizar de forma sencilla los colores principal, secundario y de acento.

## 23.2. UI común y branding

Los diálogos y el panel lateral compartirán una base visual común:

- tipografía legible, colores y botones coherentes;
- cabecera con el icono MJS, el nombre `Cuaderno del Profesor` y la versión actual obtenida de la configuración central;
- fallback visual integrado cuando un recurso de imagen no esté disponible;
- copyright discreto con `Mikel Aingeru Jorge Soteras` y `mjorgesote@educacion.navarra.es`.

Los diálogos no repetirán dentro del contenido el título nativo de la acción. La imagen splash queda reservada para posibles usos futuros y no se mostrará en los diálogos comunes actuales.

Los procesos que puedan tardar mostrarán un diálogo reutilizable con título, estado, indicador de actividad, registro breve y resultado de éxito o error. Mientras el proceso esté activo no habrá botones internos de cierre o confirmación; el botón `Cerrar` aparecerá al finalizar.

La UI común dispondrá también de confirmaciones reutilizables `normal`, `warning` y `danger`, configurables mediante título, mensaje, texto auxiliar, etiqueta de confirmación y acción. Ninguna acción asociada se ejecutará antes de la confirmación expresa del usuario. La variante `danger` y su botón rojo se reservarán para operaciones destructivas.

Google Sheets controla el marco nativo de los diálogos de Apps Script. Su botón X no puede ocultarse ni bloquearse completamente desde el HTML del proyecto. Si el usuario lo utiliza durante un proceso, la operación podrá quedar completada solo hasta el último paso ejecutado y deberá poder reanudarse de forma segura.


# 24. Validaciones

Se validará al menos:

- Curso académico válido.
- Inicio anterior a fin.
- Evaluaciones cronológicamente coherentes.
- Fin de prácticas posterior al inicio.
- Tramos horarios coherentes.
- Grupo existente.
- Módulo existente.
- Relación módulo-grupo válida.
- Pesos de UT por evaluación = 100 %.
- Pesos de evaluaciones para junio = 100 %.
- Notas entre 0 y 10.
- Sesiones de UT no negativas.

Los errores deberán expresarse en lenguaje comprensible.

Ejemplo:

```text
No se puede crear el seguimiento de PMDM - DAM2A.
Falta configurar el horario de este módulo.
```

# 25. Generación segura de hojas

Antes de crear calendario, seguimiento o evaluación, el sistema comprobará si ya existe la hoja correspondiente.

No se crearán duplicados accidentales.

# 26. Rendimiento y automatización

Se priorizarán:

- Fórmulas.
- Formato condicional.
- Lecturas/escrituras por bloques.
- Apps Script cuando aporte valor.

Se evitarán:

- Bucles con lecturas celda a celda cuando puedan evitarse.
- Trucos destructivos para forzar recálculos.
- Automatizaciones innecesarias en cada edición.

# 27. Privacidad

El archivo contendrá datos personales y académicos.

Por tanto:

- No se compartirán públicamente hojas con alumnado.
- La plantilla distribuible estará vacía de datos personales.
- No se crearán enlaces públicos automáticamente.
- No se enviarán datos a servicios externos salvo acción explícita.

# 28. Versionado

En `_META`:

```text
Versión del cuaderno: 1.2.2
Versión del esquema: 2
```

La versión podrá mostrarse discretamente en Portada o panel.

No habrá sistema automático de actualizaciones.

Cada curso se utilizará una copia nueva de la plantilla disponible.


# 29. Funcionalidades futuras

Fuera de V1:

## Google Calendar
- Exportar horario.
- Crear reuniones.
- Crear coordinaciones.
- Crear eventos desde fechas del cuaderno.

## People API
- Crear contactos directamente.
- Crear grupos/etiquetas.
- Sincronizar.

## Resultados de Aprendizaje
- Relación UT ↔ RA.
- Ponderaciones.

## Sincronización estructural avanzada
- Detectar cambios tardíos del calendario.
- Añadir/eliminar sesiones futuras.
- Reconciliar seguimientos conservando históricos.

## Catálogo preconfigurado de módulos
- Banco de módulos de FP de Navarra.
- Horas normativas.
- Curso.
- Familia profesional.

# 30. Flujo anual recomendado

```text
1. Hacer copia de la plantilla
2. Preparar nuevo curso
3. Confirmar profesor y centro
4. Configurar calendario
5. Configurar tramos
6. Configurar módulos y grupos
7. Configurar horario
8. Importar alumnado cuando esté disponible
9. Ajustar matrículas por módulo
10. Crear calendarios de módulo
11. Definir UT y sesiones
12. Configurar evaluación
13. Crear seguimientos
14. Crear hojas de evaluación
15. Uso diario
```

No todo debe completarse al principio del curso.

# 31. Dependencias

**Calendario de módulo requiere:**

```text
Calendario escolar
+ módulo
+ grupo
+ horario
```

**Seguimiento requiere:**

```text
Calendario de módulo
+ UT
+ planificación
```

**Evaluación requiere:**

```text
Módulo
+ grupo
+ alumnado
+ matrícula
+ UT
+ ponderaciones
```

**CSV requiere:**

```text
Alumnado
+ grupo
+ email
```


# 32. Criterios de aceptación de V1

La primera versión se considerará funcional cuando permita:

1. Crear una copia limpia.
2. Preparar el curso.
3. Registrar profesor y centro.
4. Crear el calendario escolar.
5. Definir tipos y fechas.
6. Mostrar hoy y días pasados.
7. Calcular estadísticas lectivas.
8. Definir tramos.
9. Crear el horario.
10. Definir módulos y grupos.
11. Calcular sesiones disponibles.
12. Importar alumnado.
13. Ajustar matrícula.
14. Exportar CSV de contactos.
15. Crear calendario de módulo.
16. Definir UT, colores y sesiones.
17. Distribuir UT automáticamente.
18. Crear seguimiento.
19. Registrar horas reales y mejoras.
20. Calcular acumulados.
21. Replanificar el futuro si una UT se adelanta o retrasa.
22. Crear evaluación.
23. Introducir notas de UT.
24. Calcular medias ponderadas.
25. Introducir notas Educa.
26. Consultar ayuda desde el panel.

# 33. Prioridad de desarrollo

## Fase 1 — Núcleo
```text
Estructura
_CONFIG
_META
Portada
Menú
Panel básico
Preparar nuevo curso
```

## Fase 2 — Calendario
```text
_FECHAS
Calendario
Tipos de enseñanza
Evaluaciones
Festivos
Vacaciones
Prácticas
Repaso
Hoy
Días pasados
Estadísticas
```

## Fase 3 — Horario y módulos
```text
_TRAMOS
_MODULOS
Horario
Actividades
Módulos/grupos
Apoyos
Cálculo de sesiones
```

## Fase 4 — Alumnado
```text
Alumnado
_MATRICULAS
Asignación por módulo
CSV Contacts
```

## Fase 5 — Calendario de módulo
```text
UT
Colores
Sesiones
Distribución automática
Estadísticas
Ponderaciones
```

## Fase 6 — Seguimiento
```text
Fechas
Horas previstas/reales
Acumulados
Mejoras
Excesos
Repasos
Replanificación futura
```

## Fase 7 — Evaluación
```text
Alumnado
Notas UT
Medias
Colores
Educa
Junio
```

## Fase 8 — Pulido
```text
Validaciones
Errores
Protecciones
Ayuda
Diseño
Optimización
Pruebas
```


# 34. Filosofía de V1

Se priorizará:

```text
Útil
Estable
Visual
Rápida
Comprensible
Fácil de mantener
```

por encima de:

```text
Automatizarlo absolutamente todo
Resolver todos los casos excepcionales
Sincronizar todos los servicios de Google
Construir una aplicación excesivamente compleja
```

# 35. Decisiones funcionales cerradas

- Un único calendario escolar visual.
- Prioridad a colores frente a indicadores adicionales.
- Si una fecha tiene varios significados, visualmente se muestra el primero.
- El color del mes depende de la evaluación del día 1.
- Una sesión equivale a una hora docente.
- Impartición = módulo + grupo.
- El alumnado puede configurarse después.
- Existirá matrícula por módulo.
- Contacts se resolverá inicialmente mediante CSV.
- Los RA quedan fuera de V1.
- Moodle calcula las notas internas de cada UT.
- El cuaderno recibe la nota final de UT.
- Una nota ausente se trata como 0.
- La nota 0 se resalta especialmente.
- Recuperaciones en Moodle.
- Nota Educa manual e independiente.
- El seguimiento replanifica hacia adelante o hacia atrás.
- La replanificación no altera histórico realizado.
- No habrá sincronización estructural compleja de calendarios en V1.
- Habrá versionado, pero no actualizaciones automáticas.
- Google Calendar y People API quedan como ampliaciones.
- El panel lateral será ayuda, asistente y diagnóstico.
- La simplicidad tendrá prioridad sobre la exhaustividad.

# 36. Resultado esperado

El docente deberá poder abrir el archivo y comprender rápidamente:

```text
Dónde estoy en el curso
Qué tengo hoy
Qué módulos imparto
Cuántas sesiones tengo
Qué UT estoy impartiendo
Qué tenía previsto hacer
Qué he hecho realmente
Si voy adelantado o retrasado
Cuántas horas he dedicado a cada UT
Qué debo mejorar
Qué notas tiene cada alumno
Qué media obtiene
Qué nota he puesto en Educa
```

Todo ello sin necesidad de conocer Apps Script y con ayuda integrada suficiente para que otro docente pueda utilizar una copia nueva de forma autónoma.

---

**Fin de la definición funcional v1.0.**
