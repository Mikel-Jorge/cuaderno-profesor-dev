# AGENTS.md — Cuaderno del Profesor

## Propósito

Este repositorio contiene el código fuente del proyecto **Cuaderno del Profesor (CP_DEV)**, un Google Sheet con un proyecto Google Apps Script vinculado.

El desarrollo se realiza localmente con VS Code/Codex, se versiona con Git/GitHub y se sincroniza con Google Apps Script mediante `clasp`.

## Fuentes de verdad

- **Funcionalidad esperada:** `docs/FUNCTIONAL_SPEC.md`
- **Arquitectura técnica vigente:** `docs/ARCHITECTURE.md`
- **Estado real de implementación:** `docs/PROJECT_STATUS.md`
- **Instalación y comandos de trabajo:** `README.md`
- **Reglas permanentes para Codex:** este `AGENTS.md`

No dupliques innecesariamente información entre documentos.

### Conflictos funcionales

`docs/FUNCTIONAL_SPEC.md` es la fuente de verdad funcional.

Si una tarea del usuario **cambia explícitamente** un requisito funcional, el cambio está aprobado y debes actualizar `docs/FUNCTIONAL_SPEC.md` en el mismo commit.

Si una petición parece contradecir la especificación pero no está claro que pretenda modificarla, no inventes una interpretación: señala el conflicto antes de implementar.

## Qué documentación actualizar

Actualiza documentación solo cuando corresponda:

- Cambio de requisito o comportamiento esperado → `docs/FUNCTIONAL_SPEC.md`
- Cambio de arquitectura, módulos, responsabilidades o decisión técnica → `docs/ARCHITECTURE.md`
- Funcionalidad implementada, fase completada o estado del proyecto → `docs/PROJECT_STATUS.md`
- Cambio del flujo de trabajo de Codex → `AGENTS.md`
- Cambio de instalación, herramientas o comandos → `README.md`

Una tarea puede requerir actualizar varios documentos o ninguno.

## Reglas funcionales permanentes

Salvo que `docs/FUNCTIONAL_SPEC.md` se modifique explícitamente:

- Una sesión equivale a una hora docente.
- La unidad funcional de una impartición es `módulo + grupo`.
- Los colores representan datos; nunca deben utilizarse como fuente principal de datos.
- Los Resultados de Aprendizaje (RA) no forman parte obligatoria de V1.
- Moodle calcula la nota interna de cada UT; el cuaderno recibe la nota final de la UT.
- Las recuperaciones se gestionan en Moodle.
- No introducir triggers instalables salvo petición expresa.
- Google Calendar y People API quedan fuera de V1 salvo cambio explícito de alcance.
- Priorizar soluciones simples y mantenibles sobre arquitecturas innecesariamente complejas.
- Los diálogos de configuración deben ser side-effect free al abrirse. Leer configuración no debe reparar, crear, ocultar, reordenar ni regenerar hojas. Las reparaciones estructurales son explícitas; los guardados solo actualizan el modelo afectado y sus vistas derivadas necesarias.

## Reglas de desarrollo Apps Script

- Proyecto Apps Script vinculado al Google Sheet `CP_DEV`.
- Usar JavaScript compatible con el runtime V8 de Apps Script.
- Código modular y nombres descriptivos.
- No inventar servicios, APIs, métodos ni permisos de Google.
- Considerar siempre scopes, permisos y restricciones de Google Workspace.
- Priorizar lecturas y escrituras por bloques frente a operaciones celda a celda.
- Todas las hojas visibles generadas deben ajustar sus filas y columnas al layout real. Antes de escribir deben poder ampliarse y, al finalizar su generación, deben recortarse de forma segura a su área útil.
- Evitar lógica basada en posiciones rígidas si puede modelarse mediante configuración.
- Evitar operaciones destructivas salvo que estén expresamente diseñadas y confirmadas.
- No introducir dependencias externas sin una necesidad clara.
- No incluir datos personales reales, alumnado real, credenciales ni secretos en el repositorio.

## Flujo obligatorio para una tarea que modifica el repositorio

Antes de empezar:

1. Ejecuta `git status`.
2. Ejecuta `git pull --ff-only`.
3. Si existen cambios locales previos no relacionados, no los sobrescribas ni los descartes.
4. Lee únicamente la documentación relevante para la tarea. No releas todo el repositorio sin necesidad.

Durante la tarea:

1. Implementa un único cambio lógico coherente.
2. Mantén actualizada la documentación que corresponda según las reglas anteriores.
3. Revisa `git diff` antes de cerrar la tarea.
4. Comprueba que no se hayan añadido secretos, credenciales o datos reales.
5. Realiza las verificaciones disponibles.

Al finalizar una tarea con cambios:

1. Crea **un commit descriptivo** para esa tarea.
2. Si han cambiado archivos de Apps Script (`.gs`, `.html` o `appsscript.json`), ejecuta `clasp push`.
3. Si `clasp push` falla, no hagas `git push`; informa del problema dejando el commit local intacto.
4. Si `clasp push` devuelve `Skipping push.` o un resultado ambiguo, no asumas que Apps Script está actualizado: ejecuta `clasp status`, verifica que los archivos locales relevantes están sincronizados y, si es necesario, vuelve a ejecutar `clasp push`.
5. No uses `clasp push -f` automáticamente. Solo úsalo si existe una razón clara y segura.
6. Si la sincronización con Apps Script es correcta y verificable, ejecuta `git push`.
7. No uses `--force`, `reset --hard`, rebase destructivo ni reescritura de historial salvo petición expresa.

Las tareas puramente informativas que no cambien archivos no requieren commit.

## Convención de commits

Usa mensajes breves, concretos y relacionados con una sola tarea:

- `feat(portada): crea la estructura inicial`
- `feat(calendario): genera el calendario escolar`
- `fix(horario): corrige el resaltado de la sesión actual`
- `refactor(modulos): separa lectura y renderizado`
- `docs(funcional): actualiza reglas de evaluación`
- `chore(config): ajusta configuración del proyecto`
- `test(calendario): añade casos de validación`

No uses mensajes genéricos como `cambios`, `update`, `fix` o `prueba`.

## Política de versionado

La versión del cuaderno sigue SemVer y tiene una única fuente de verdad en `Config.gs`:

- Cada commit normal incrementa `PATCH`: `1.0.0` → `1.0.1` → `1.0.2`.
- Cuando una funcionalidad o bloque se considera cerrado, se incrementa `MINOR` y se reinicia `PATCH`: `1.0.x` → `1.1.0`.
- `MAJOR` se reserva para cambios incompatibles o hitos grandes y solo se incrementa por decisión explícita.

Antes de cerrar cualquier commit que modifique el proyecto:

1. Determina la siguiente versión según esta política.
2. Actualiza la fuente central de versión en `Config.gs`.
3. Comprueba que el código de inicialización sincroniza `_META` desde esa fuente como texto.
4. Actualiza la documentación que muestre la versión vigente.

No dupliques la versión como constante en otros archivos; `_META` y la UI deben obtenerla de la fuente central.

## Relación Git / clasp

- GitHub es la fuente de verdad del **código versionado**.
- `CP_DEV` es el entorno de ejecución y prueba.
- `clasp push` sincroniza local → Apps Script.
- `clasp pull` se utiliza solo cuando se han hecho deliberadamente cambios en el editor web que deben recuperarse.
- Evita editar simultáneamente el mismo código en VS Code y en el editor web.

## Final de cada tarea

Informa de forma breve:

- Qué se ha cambiado.
- Qué documentación se ha actualizado.
- Qué verificaciones se han realizado.
- Resultado de `clasp push`, si correspondía.
- Commit creado (hash corto + mensaje).
- Resultado de `git push`.
- Cualquier prueba manual que todavía deba realizar el usuario en Google Sheets.
