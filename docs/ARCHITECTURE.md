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

La separación exacta de archivos se concretará al comenzar la implementación. Como principio general:

1. **Configuración y metadatos**
2. **Generadores/renderizado de hojas**
3. **Lógica de dominio**
4. **Acceso a Sheets**
5. **UI: menú, panel lateral y diálogos**
6. **Utilidades comunes**

No crear capas o abstracciones hasta que exista una necesidad real.

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
