# Guía de uso · Cuaderno del Profesor 1.8.4

## Empezar un curso

El cuaderno se distribuye como copia de una plantilla inicializada. Usa el único menú **📘 Cuaderno del Profesor 📘**. Sus submenús son **Configuración** (🪪 Configurar datos del docente y centro, 📅 Configurar calendario, 🕒 Configurar horario) y **Módulos** (Crear configuración, Recalcular, Crear seguimiento y evaluación). Después aparecen **Reparar estructura**, **Preparar nuevo curso** y **Ayuda**. No hay un asistente de configuración independiente.

Para pasar de un curso a otro, abre **Preparar nuevo curso**. Un único diálogo guía siete pasos. Abrirlo no modifica el cuaderno; la copia y el reinicio comienzan al pulsar **Crear copia y preparar** en Seguridad. **Siguiente** guarda el paso actual sin redibujar todavía las hojas. Puedes volver a pasos visitados desde el indicador superior; Atrás y el indicador descartan los cambios que aún no hayas guardado. Los pasos pendientes muestran un aviso ámbar con su motivo. **Finalizar y generar cuaderno** aplica todas las vistas en una espera final.

1. **Seguridad:** indica el nuevo curso y crea una copia verificada antes de reiniciar datos anuales.
2. **Datos del docente y centro:** comprueba el curso propuesto, docente, centro, web y tema. El formato es `YYYY-YYYY`.
3. **Calendario:** revisa tipos, fechas lectivas, evaluaciones, FEOE, repaso, festivos, Navidad y Semana Santa con el calendario del centro.
4. **Tramos:** revisa los periodos consecutivos conservados del curso anterior.
5. **Actividades:** revisa nombre, sigla, grupo, aula, color, tipo y categoría.
6. **Horario semanal:** asigna actividades y apoyos. Las sesiones anteriores parten vacías.
7. **Resumen:** consulta lo completado y lo pendiente. Los pasos revisados pendientes aparecen en ámbar; puedes finalizar aunque falten apartados. Después completa Alumnado y configura cada módulo.

En **Configurar datos del docente y centro** y **Preparar nuevo curso** puedes elegir entre diez temas. **Verde profesional** es el inicial. Elegir un tema actualiza los tres colores visibles; después puedes ajustar Principal, Secundario y Acento por separado. Guarda y vuelve a abrir para comprobarlos. **Reparar estructura** conserva los colores personalizados.

Durante el curso puedes usar por separado **Configuración → Configurar datos del docente y centro**, **Configuración → Configurar calendario** y **Configuración → Configurar horario**. Una sesión representa una hora docente aunque el tramo dure otro número de minutos.

## Hojas y orden de trabajo

- **0 Portada** resume curso, docente y centro, y ofrece un índice navegable.
- **1 Calendario** deriva de tipos, periodos, evaluaciones y fechas especiales. FEOE excluye sesiones reales de los módulos.
- **2 Horario** muestra la semana lectiva y su actividad actual. Calendario y Horario deben estar configurados para calcular las sesiones reales de **4 Config**.
- **3 Alumnado** requiere Apellidos, Nombre y Grupo; Email es opcional. REACA es un checkbox y Medidas admite texto, que aparece como nota en Eval. El Cuaderno conserva internamente la identidad de cada persona para no mezclar notas al ordenar.
- **4 Config** se crea desde **Cuaderno del Profesor → Módulos → Crear configuración de módulo** cuando la actividad es de categoría MODULO y tiene sesiones reales. Cada módulo + grupo es independiente. Introduce UT, horas, colores y pesos; usa **Cuaderno del Profesor → Módulos → Recalcular configuración del módulo** para aplicar cambios de planificación. Las horas se reparten cronológicamente; cada UT pertenece a la evaluación en la que termina. El resumen muestra disponibles, pendientes, Peso UTs y Peso final. El aviso marca cambios aún no aplicados. Los colores son presentación, nunca datos.
- **5 Seg** se crea desde **Cuaderno del Profesor → Módulos → Crear seguimiento y evaluación**. Es una instantánea editable: Fecha y Total son derivados; registra UT, Plan previsto, Actividades realizadas, Actual y Mejoras. Acum. suma por UT incluso si aparece intercalada. Rojo señala que se superó el total inicial y el amarillo en Mejoras indica una propuesta. Cambios posteriores de Config no reescriben esta instantánea.
- **6 Eval** recibe la nota final de cada UT calculada en Moodle, de 0–10 con decimales. Una UT vacía cuenta como cero en Media. Las medias y Media final leen en vivo los pesos de Config; Educa de cada evaluación y Educa final se introducen manualmente (1–10 o MH), con semáforo. MEDIA DEL GRUPO resume el grupo. Las recuperaciones se gestionan en Moodle. Tras cambios de Alumnado, selecciona Alumnado y 6 Eval en **Reparar estructura** para sincronizar.

**Dependencias:** Calendario + Horario → Config → Seg y Eval; Alumnado → Eval; ponderaciones de Config → medias de Eval. Seg es una instantánea inicial que luego refleja lo ocurrido, mientras Eval lee los pesos actuales de Config.

## Reparar estructura

El menú **Reparar estructura** abre un selector. Los siete bloques visibles empiezan marcados: Portada, Calendario, Horario, Alumnado, 4 Config, 5 Seg y 6 Eval. Puedes marcar o desmarcar todos. Con ninguno marcado se realiza solo mantenimiento técnico. Al confirmar se comprueban las tablas técnicas, referencias, metadatos, orden y protecciones; solo los bloques elegidos se regeneran. La reparación conserva los datos docentes. Si eliges solo Alumnado, Eval no cambia; si eliges solo Config, Seg y Eval no cambian. Los históricos **5 Seg OLD** solo reciben orden, color de pestaña y aviso de protección. Las protecciones `CUADERNO:` muestran advertencias; tus protecciones manuales permanecen.

## Preparar nuevo curso

**Preparar nuevo curso** es una acción excepcional. Dentro del mismo diálogo, primero crea y verifica una copia completa en la carpeta elegida (la actual por defecto). Solo entonces mueve o renombra el cuaderno activo y reinicia datos anuales: alumnado, horario semanal y fechas del calendario. Conserva docente, centro, tema, tramos y actividades; archiva Seguimiento como OLD y elimina Config y Eval anteriores. Si cancelas después de Seguridad, los datos guardados permanecen y el diálogo aplica automáticamente las vistas antes de cerrarse. Cancelar antes de Seguridad no cambia nada.

## Ayuda y estado

**Ayuda** abre una barra lateral adaptada al espacio estrecho de Sheets. Muestra un resumen dinámico de controles correctos y solo los pendientes; **Ver detalle** sustituye esa lista por todos los controles. Durante la búsqueda se oculta el estado para dejar espacio a los resultados. Las secciones se despliegan una a una y la FAQ tiene preguntas propias. El buscador funciona sin tildes ni distinción de mayúsculas: por ejemplo, `evaluacion`, `peso`, `protegida` o `REACA`. La X limpia la búsqueda. **Actualizar estado** vuelve a cargar los datos una vez, sin consultas continuas.

## Preguntas frecuentes

**No aparece un módulo para configurar.** Comprueba que la actividad es MODULO, tiene grupo, está en el horario y cuenta con sesiones lectivas según Calendario y FEOE.

**No aparece un módulo para crear Seguimiento y Evaluación.** Completa Config, aplica la planificación y revisa UT y ponderaciones.

**He borrado 4 Config.** Las UT que vivían solo en esa hoja se han perdido. Al volver a crear, el registro técnico huérfano se limpia. Consulta el backup para recuperar datos docentes.

**He borrado 6 Eval.** Reparar puede crear otra hoja sin tocar Seg, pero las notas perdidas solo se encuentran en el backup.

**He cambiado una UT.** Recalcula Config si cambió la planificación. Seg conserva su instantánea. Si la estructura de UT ya no coincide con Eval, Reparar estructura avisa y preserva sus notas existentes.

**¿Puedo cambiar la UT en Seguimiento?** Sí. Seg representa lo que realmente ocurrió; Acum. continúa sumando por la UT elegida.

**¿Cómo se tratan UT vacías y MH?** Una UT sin nota cuenta como cero en la media del grupo. `MH` en Educa equivale a diez para esa media; se conserva su texto visible.

**¿Qué es OLD?** Es un Seguimiento histórico del curso anterior. No se resincroniza ni se reconstruye.

**Un alumno ya no está en Alumnado.** Eval conserva la fila histórica con su ID y sus notas. Las nuevas altas se ordenan por apellidos y nombre sin mover las notas de otras personas.

**Se han roto fórmulas o formatos.** Usa Reparar estructura y marca el bloque afectado. Comprueba antes si has cambiado la estructura de UT: Eval no sustituye una estructura incompatible.

**¿Por qué veo un aviso de protección?** Las protecciones del cuaderno son advertencias y permiten editar los campos docentes. No eliminan las protecciones que hayas añadido tú.

**¿Por qué un cambio de peso afecta a Eval pero no a Seg?** Eval referencia los pesos de Config directamente. Seg conserva los valores capturados al crearse.

**¿Qué hace FEOE?** Marca un periodo sin sesiones docentes reales de ese tipo de enseñanza para el cálculo de planificación de módulos.
