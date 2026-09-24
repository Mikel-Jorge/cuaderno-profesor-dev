# Arquitectura técnica

**Estado:** inicial  
**Última revisión:** 2026-09-24

Este documento describe únicamente la arquitectura técnica vigente.  
La funcionalidad esperada se define en `FUNCTIONAL_SPEC.md`.

## Plataforma

- Google Sheets como interfaz principal.
- Google Apps Script vinculado al Spreadsheet.
- HTML/CSS/JavaScript de Apps Script para panel lateral y diálogos.
- Desarrollo local mediante VS Code/Codex.
- `clasp` para sincronizar código con Apps Script.
- Git/GitHub para control de versiones.

## Principio de diseño

La estructura visual del Google Sheet debe poder generarse y mantenerse mayoritariamente desde Apps Script:

- Hojas.
- Fórmulas.
- Formatos.
- Colores.
- Anchuras y alturas.
- Validaciones.
- Formato condicional.
- Rangos y configuración.

Se recurrirá a edición manual únicamente cuando resulte claramente más sencillo y no comprometa la reproducibilidad del proyecto.

## Capas previstas

La implementación inicial utiliza una separación sencilla de responsabilidades:

- `Config.gs`: constantes compartidas, nombres de hojas y fuente central de la versión del cuaderno.
- `Theme.gs`: tokens visuales, presets, personalizaciones y adaptación del tema a Sheets y CSS.
- `Main.gs`: funciones públicas de UI, incluyendo `onOpen()` y ayuda temporal.
- `Setup.gs`: inicialización idempotente de la estructura base.
- `GeneralConfig.gs`: definición, migración, lectura, validación y persistencia diferencial de la configuración general y visual.
- `Portada.gs`: reparación de estructura, actualización diferencial de datos, aplicación del tema y generación del índice navegable.
- `Utils.gs`: utilidades comunes de acceso y organización de hojas.
- `Ui.gs`: apertura de diálogos, registro de procesos UI y ejecución secuencial de pasos.
- `UiDialogProgress.html`: diálogo reutilizable para procesos con progreso, resultado y log.
- `UiDialogConfirmation.html`: confirmación reutilizable con variantes normal, warning y danger.
- `UiDialogGeneralConfig.html`: edición de los datos generales almacenados en `_CONFIG`.
- `UiStyles.html`: estilos visuales comunes para HTML de Apps Script.
- `Branding.gs`: recursos de branding embebidos y fallback visual sin dependencias externas.

Como principio general para las siguientes fases:

1. **Configuración y metadatos**
2. **Generadores/renderizado de hojas**
3. **Lógica de dominio**
4. **Acceso a Sheets**
5. **UI: menú, panel lateral y diálogos**
6. **Utilidades comunes**

No crear capas o abstracciones hasta que exista una necesidad real.

## UI HTML y procesos largos

Los diálogos se construyen con plantillas de `HtmlService` y parciales compartidos. La cabecera común recibe el nombre del proyecto y la versión desde `Config.gs`, evitando hardcodearlos en HTML. Los títulos nativos y el menú reutilizan las etiquetas con iconos funcionales centralizadas en `CP.MENU`. `Theme.gs` resuelve el preset y las personalizaciones almacenadas, y los inyecta como variables CSS en todas las plantillas comunes.

Un proceso UI declara sus pasos en servidor; el cliente los invoca en secuencia mediante `google.script.run`, actualizando el estado después de cada respuesta. Las funciones de dominio continúan siendo ejecutables directamente sin depender del diálogo.

Las confirmaciones se definen y validan en servidor mediante identificadores de acción permitidos. El cliente solo solicita la acción después de una pulsación expresa; no recibe nombres de funciones arbitrarios. Las variantes `normal`, `warning` y `danger` comparten plantilla y estilos, reservando `danger` para operaciones destructivas.

Los logos originales se conservan en `branding/`. Para que Apps Script pueda mostrarlos sin publicar archivos ni depender de URLs externas, `Branding.gs` contiene copias reducidas como `data:` URI. Estas constantes confiables se imprimen sin escape contextual en los atributos `src`; el resto de datos visibles permanece escapado. Si un recurso embebido no está disponible, se genera un fallback SVG simple. El recurso splash permanece disponible para usos futuros, pero no se renderiza en los diálogos comunes actuales.

El marco nativo de `showModalDialog()` pertenece a Google Sheets. La X nativa no puede ocultarse ni bloquearse desde el contenido HTML; por ello los pasos deben ser idempotentes y permitir reparar una ejecución interrumpida.

## Hojas técnicas previstas

Según la definición funcional actual:

```text
_CONFIG
_FECHAS
_TRAMOS
_MODULOS
_MATRICULAS
_UT
_META
```

Podrán variar si la implementación demuestra que una estructura más sencilla es suficiente.

En la estructura base inicial solo se crean `_CONFIG` y `_META`. El resto de hojas técnicas se crearán cuando se implemente la funcionalidad correspondiente.

`_CONFIG` mantiene un modelo estricto de dos columnas, clave/valor, y conserva las claves desconocidas al reparar o migrar su estructura. Incluye los datos generales y la selección/personalización del tema. `0 Portada` es una vista generada desde esta configuración y no actúa como fuente de datos. `_META` contiene únicamente proyecto, versión del cuaderno y versión del esquema, obteniendo las versiones de `Config.gs`.

La inicialización puede reconstruir la estructura gestionada de la Portada. Un guardado ordinario no ejecuta ese renderizado completo: compara la configuración anterior, persiste solo las claves modificadas, actualiza los rangos de datos afectados y reaplica exclusivamente los estilos cuando cambia el tema.

## Restricciones técnicas vigentes

- Sin triggers instalables en V1 salvo necesidad nueva aprobada.
- Sin People API en V1.
- Sin integración obligatoria con Google Calendar en V1.
- Los colores nunca son la fuente de verdad del dato.
- Priorizar operaciones batch.
- Un cuaderno corresponde a un curso académico.
- Las copias de uso real no forman parte del repositorio ni del flujo `clasp`.

## Entornos

### CP_DEV

Google Sheet de desarrollo sin datos reales.

Es el único Spreadsheet sincronizado con el repositorio mediante `clasp`.

### Cuadernos reales

Se crean como copias de `CP_DEV` cuando el código es estable.

Contienen datos reales y quedan fuera de:

- GitHub.
- Codex.
- `clasp` de desarrollo.

## Evolución de este documento

Actualizar este archivo solo cuando cambie una decisión técnica relevante, la organización de módulos o las responsabilidades entre componentes.
