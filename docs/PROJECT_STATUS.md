# Estado del proyecto

**Última actualización:** 2026-09-25
**Estado general:** Fase 2 en desarrollo con modelo y vista visible compacta de calendario, versión 1.2.9

## Completado

- Definición funcional V1 acordada.
- Google Sheet `CP_DEV` creado.
- Proyecto Apps Script vinculado.
- `clasp` configurado y probado en el ordenador de casa.
- Repositorio Git/GitHub configurado.
- Primer `clasp push` probado correctamente.
- Primer `git push` probado correctamente.
- `README.md` de configuración creado.
- Función pública `inicializarCuaderno()` implementada.
- Menú `📘 Cuaderno del Profesor` implementado con:
  - `🆕 Preparar nuevo curso`.
  - `🔄 Inicializar / reparar estructura`.
  - `⚙️ Configuración > 👤 Datos generales`.
  - `❓ Ayuda` mediante panel lateral.
- Hoja visible `0 Portada` terminada, generada por Apps Script y alimentada desde `_CONFIG`, con correos diferenciados y enlaces navegables.
- Índice dinámico navegable de hojas visibles implementado en la portada.
- Hojas técnicas `_CONFIG` y `_META` creadas y ocultas.
- `_META` incluye únicamente proyecto, versión del cuaderno y versión del esquema.
- `_CONFIG` utiliza dos columnas clave/valor y contiene curso, profesor, correo del profesor, datos completos del centro y preferencias de tema.
- Propuesta automática del curso académico según fecha y zona horaria del Spreadsheet.
- Diálogo de datos generales con carga, validación, estado dirty/clean, cierre tras éxito y actualización diferencial de la portada.
- Sistema global de temas claros con tokens centralizados, colores personalizables y seis presets: Océano, Turquesa naranja, Verde natural, Coral menta, Burdeos lavanda y Azul clásico.
- Portada separada en reparación estructural, actualización de datos, aplicación de tema e índice.
- Web del centro normalizada y validada aunque se introduzca sin protocolo.
- Utilidades globales para ampliar hojas y recortarlas al layout; aplicadas a la Portada `A:H` con filas dinámicas.
- `_META` escribe las versiones como texto para evitar su conversión a fecha.
- Versión central del cuaderno `1.2.9` y esquema `5`.
- Infraestructura HTML común para diálogos de Apps Script implementada.
- Diálogo reutilizable de progreso con spinner, estados, log breve y resultado final.
- La inicialización se ejecuta desde el diálogo en cinco pasos idempotentes.
- Branding local integrado en la UI sin dependencias externas, con fallback visual.
- Impresión de las Data URI corregida para que los logos se rendericen en las plantillas HTML.
- Diálogo reutilizable de confirmación con variantes `normal`, `warning` y `danger`.
- La inicialización requiere confirmación expresa antes de abrir el progreso.
- Cabecera común con icono MJS, nombre del proyecto y versión centralizada.
- Copyright visible de forma discreta en el pie de la UI.
- Splash retirado de los diálogos comunes y reservado para posibles usos futuros.
- Títulos nativos y opciones de menú con iconografía funcional coherente.
- Panel lateral permanente con branding, tema activo, versión y copyright compartidos.
- Estado real de datos generales y señalización explícita de áreas todavía no disponibles.
- Ayuda breve colapsable, con Portada priorizada cuando esa hoja está activa.
- Actualización manual del estado, contexto y tema sin polling ni triggers.
- Sidebar simplificado sin duplicar las acciones disponibles en el menú principal.
- Confirmación `danger` previa a Preparar nuevo curso, sin cambios antes de la aceptación expresa.
- Primera versión del asistente de nuevo curso con curso académico, profesor y centro, apariencia, ubicación y resumen.
- Navegador propio de carpetas de Mi unidad con ruta, subcarpetas, regreso al nivel superior y selección sin mostrar IDs.
- Copia de seguridad obligatoria y automática, verificada en la carpeta original con el nombre original exacto.
- Movimiento opcional del cuaderno activo mediante `File.moveTo()` antes de modificar su configuración.
- Renombrado obligatorio del cuaderno activo a `CuadernoProfesor_XXXX` a partir del curso académico.
- Recuperación defensiva de configuración, Portada, metadatos, nombre y ubicación originales, conservando siempre la copia.
- Proceso de nuevo curso mediante el diálogo común de progreso, con pasos condicionales y detención ante errores.
- Actualización validada de `_CONFIG`, Portada, índice y `_META`, sin crear ni borrar estructuras futuras.
- Hojas técnicas `_CAL_TIPOS`, `_CAL_EVALUACIONES`, `_FECHAS` y `_CAL_FECHA_TIPOS` creadas, ocultas y reparadas de forma idempotente.
- Migración idempotente del antiguo `_FECHAS.tipo_id` al modelo N:M, con ausencia de relaciones como semántica central de evento global.
- Modal `📅 Configurar calendario` organizado en cinco acordeones, con separación basada en el tema, tipos activables y prácticas/repaso opcionales.
- Fechas especiales de día único o rango, aplicables globalmente o a varios tipos sin duplicar el evento.
- Mejora UX del configurador de calendario: al desactivar un tipo se colapsa su bloque sin perder datos, y cada fecha especial se muestra como tarjeta colapsable con resumen vivo.
- Propuestas editables de fecha final para periodos y evaluaciones sin sobrescribir valores existentes.
- Guardado coherente del calendario con validación completa, bloqueo, escrituras por bloques y restauración de las cuatro tablas ante errores.
- Fechas reales, límites derivados del curso académico y tratamiento explícito de zona horaria.
- Consultas reutilizables para tipos, evaluaciones, eventos, prioridad visual y días no lectivos.
- Solapamientos conservados como datos independientes; fines de semana derivados sin filas técnicas.
- Vista visible de `1 Calendario` compactada a septiembre-junio en cuadrícula 5x2, con leyenda horizontal y estadísticas sin ajuste de texto.
- Guardar la configuración de calendario e `Inicializar / reparar` regeneran `1 Calendario` desde la fuente de verdad.
- Categorías de fechas especiales simplificadas a `FESTIVO`, `REUNION` y `DESTACADO`, con normalización de categorías anteriores a `FESTIVO`.
- Nueva iteración UX del calendario: configurador inicialmente colapsado, botón `+ Añadir fecha` al final, fin de evaluación con color común y layout visible en orden cabecera, leyenda, calendario y estadísticas.

## Pendiente inmediato

- Probar manualmente las seis paletas, el cierre del diálogo, la URL normalizada y el recorte de la Portada en `CP_DEV`.
- Ampliar Preparar nuevo curso cuando existan calendario, tramos, módulos y horario.
- Validar manualmente en `CP_DEV` la vista compacta y la UX de acordeones de `1 Calendario` antes de cerrar definitivamente el bloque Calendario.
- Evaluar en una fase posterior mover `Inicializar / reparar estructura` a un área `🛠️ Mantenimiento > 🔧 Reparar estructura` y retirar “Inicializar” de la UX final. Por ahora se conserva para desarrollo, migraciones y recuperación, no como operación cotidiana del profesor.

## Fase 1 prevista

Según la definición funcional:

```text
Estructura base
_CONFIG
_META
0 Portada
Menú "Cuaderno del profesor"
Panel lateral básico
Preparar nuevo curso
```

Estado actual de la fase:

- Completado: estructura base, configuración general, `_CONFIG`, `_META`, `0 Portada`, índice dinámico, menú inicial e infraestructura UI común.
- Completado: panel lateral básico de ayuda y estado.
- En curso: Preparar nuevo curso dispone de una primera versión para las áreas ya implementadas.
- En curso: Fase 2 Calendario; modelo, persistencia, configuración y primera vista visible completados, renderizado pendiente de validación manual.
- Pendiente: ampliar el asistente con calendario, tramos, módulos y horario cuando existan.

## Regla de actualización

Este archivo refleja **qué existe realmente**, no qué está previsto.

Actualizarlo cuando:

- se complete una funcionalidad;
- se inicie o finalice una fase;
- cambie de forma material el estado del proyecto.

Los requisitos futuros pertenecen a `FUNCTIONAL_SPEC.md`, no a este documento.
