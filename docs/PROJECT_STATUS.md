# Estado del proyecto

**Última actualización:** 2026-09-24  
**Estado general:** ubicación opcional del cuaderno añadida a Preparar nuevo curso en versión 1.2.2

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
- Versión central del cuaderno `1.2.2` y esquema `2`.
- Infraestructura HTML común para diálogos de Apps Script implementada.
- Diálogo reutilizable de progreso con spinner, estados, log breve y resultado final.
- La inicialización se ejecuta desde el diálogo en cuatro pasos idempotentes.
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
- Copia de seguridad opcional, activada por defecto, verificada y conservada en la carpeta original.
- Movimiento opcional del cuaderno activo mediante `File.moveTo()` antes de modificar su configuración.
- Recuperación defensiva de configuración y ubicación original ante errores posteriores al movimiento.
- Proceso de nuevo curso mediante el diálogo común de progreso, con pasos condicionales y detención ante errores.
- Actualización validada de `_CONFIG`, Portada, índice y `_META`, sin crear ni borrar estructuras futuras.

## Pendiente inmediato

- Probar manualmente las seis paletas, el cierre del diálogo, la URL normalizada y el recorte de la Portada en `CP_DEV`.
- Ampliar Preparar nuevo curso cuando existan calendario, tramos, módulos y horario.

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
- Pendiente: ampliar el asistente con calendario, tramos, módulos y horario cuando existan.

## Regla de actualización

Este archivo refleja **qué existe realmente**, no qué está previsto.

Actualizarlo cuando:

- se complete una funcionalidad;
- se inicie o finalice una fase;
- cambie de forma material el estado del proyecto.

Los requisitos futuros pertenecen a `FUNCTIONAL_SPEC.md`, no a este documento.
