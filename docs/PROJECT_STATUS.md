# Estado del proyecto

**Última actualización:** 2026-09-24  
**Estado general:** núcleo de configuración general y portada funcional implementados

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
  - `🔄 Inicializar / reparar estructura`.
  - `⚙️ Configuración > 👤 Datos generales`.
  - `❓ Ayuda` temporal mediante diálogo.
- Hoja visible `0 Portada` terminada, generada por Apps Script y alimentada desde `_CONFIG`.
- Índice dinámico navegable de hojas visibles implementado en la portada.
- Hojas técnicas `_CONFIG` y `_META` creadas y ocultas.
- `_META` incluye únicamente proyecto, versión del cuaderno y versión del esquema.
- `_CONFIG` contiene curso, profesor y datos completos del centro en formato clave/valor.
- Propuesta automática del curso académico según fecha y zona horaria del Spreadsheet.
- Diálogo de datos generales con carga, validación, guardado y actualización inmediata de la portada.
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

## Pendiente inmediato

- Probar manualmente la configuración general, la portada y los enlaces del índice en `CP_DEV`.
- Implementar el panel lateral básico.
- Implementar el asistente de preparación de nuevo curso.

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
- Pendiente: panel lateral básico y preparar nuevo curso.

## Regla de actualización

Este archivo refleja **qué existe realmente**, no qué está previsto.

Actualizarlo cuando:

- se complete una funcionalidad;
- se inicie o finalice una fase;
- cambie de forma material el estado del proyecto.

Los requisitos futuros pertenecen a `FUNCTIONAL_SPEC.md`, no a este documento.
