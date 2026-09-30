# Estado del proyecto

**Última actualización:** 2026-09-30
**Estado general:** Portada, Calendario, Horario y Alumnado operativos; siguiente bloque `4 Config`
**Versión vigente:** `1.4.2`
**Esquema vigente:** `8`

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

# Siguiente

## Configuración de módulo

Implementar, en un bloque posterior, `4 Config <SIGLA> · <GRUPO>` por cada actividad `MODULO`, con:

- asociación interna fiable a `actividad_id`;
- calendario individual basado en sesiones reales;
- tabla de UT con horas manuales;
- evaluaciones procedentes de `_CAL_EVALUACIONES`;
- pesos UT → evaluación y evaluación → curso;
- totales automáticos;
- recálculo explícito;
- indicador de cambios pendientes sin trigger;
- representación de día mixto.

Nada de este bloque está implementado todavía.

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

Ninguna hoja 4, 5 o 6 está implementada en la versión 1.4.2. La política futura de cambio de curso ya exige eliminar las 4 y 6 antiguas y archivar las 5 como `OLD AACC` sin referencias rotas. Solo está implementada ahora la agrupación de nombres de la familia 5 por sigla; el archivado efectivo queda pendiente.

# Decisiones vigentes

- No existe `3 Módulos`.
- No existen `_MODULOS`, `_MATRICULAS` ni `_UT`.
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
