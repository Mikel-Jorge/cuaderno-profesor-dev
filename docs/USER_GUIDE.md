# Guía de uso · Cuaderno del Profesor 1.8.0

## Empezar un curso

Abre **Cuaderno del Profesor → Asistente de configuración del curso**. El asistente recorre seis pasos: datos generales, Calendario, tramos, actividades, horario semanal y resumen. Se inicia por una acción tuya; abrir el archivo no escribe datos ni muestra diálogos. Pulsa **Siguiente** para guardar los cambios del paso. Si cancelas, lo ya guardado permanece y puedes retomarlo desde el asistente o los menús de configuración. Puedes terminar aunque falten fechas o asignaciones; el resumen señala lo pendiente.

1. **Datos generales:** comprueba el curso académico propuesto, docente, centro, web y tema. El formato del curso es `YYYY-YYYY`.
2. **Calendario:** activa los tipos de enseñanza pertinentes y revisa fechas lectivas, evaluaciones, FEOE, repaso y eventos. Los festivos, Navidad y Semana Santa propuestos se pueden editar; compruébalos con el calendario del centro. Los días no lectivos reducen las sesiones disponibles.
3. **Tramos:** define periodos consecutivos. En cursos posteriores aparecen los tramos conservados.
4. **Actividades:** revisa nombre, sigla, grupo, aula, color, tipo y categoría. Sus IDs se conservan entre cursos.
5. **Horario semanal:** asigna actividades de lunes a viernes y, si procede, apoyos. En un curso nuevo parte vacío.
6. **Resumen:** consulta el estado y finaliza. El siguiente paso es introducir Alumnado y configurar cada módulo.

Durante el curso puedes usar por separado **Configuración general**, **Configurar calendario** y **Configurar horario**. Una sesión representa una hora docente aunque el tramo dure otro número de minutos.

## Hojas y orden de trabajo

- **0 Portada** resume curso, docente y centro, y ofrece un índice navegable.
- **1 Calendario** deriva de tipos, periodos, evaluaciones y fechas especiales. FEOE excluye sesiones reales de los módulos.
- **2 Horario** muestra la semana lectiva y su actividad actual. Calendario y Horario deben estar configurados para calcular las sesiones reales de **4 Config**.
- **3 Alumnado** requiere Apellidos, Nombre y Grupo; Email es opcional. REACA es un checkbox y Medidas admite texto, que aparece como nota en Eval. El Cuaderno conserva internamente la identidad de cada persona para no mezclar notas al ordenar.
- **4 Config** se crea desde **Módulos → Crear configuración de módulo** cuando la actividad es de categoría MODULO y tiene sesiones reales. Cada módulo + grupo es independiente. Introduce UT, horas, colores y pesos; usa **Módulos → Recalcular configuración del módulo** para aplicar cambios de planificación. Las horas se reparten cronológicamente; cada UT pertenece a la evaluación en la que termina. El resumen muestra disponibles, pendientes, Peso UTs y Peso final. El aviso marca cambios aún no aplicados. Los colores son presentación, nunca datos.
- **5 Seg** se crea desde **Módulos → Crear seguimiento y evaluación**. Es una instantánea editable: Fecha y Total son derivados; registra UT, Plan previsto, Actividades realizadas, Actual y Mejoras. Acum. suma por UT incluso si aparece intercalada. Rojo señala que se superó el total inicial y el amarillo en Mejoras indica una propuesta. Cambios posteriores de Config no reescriben esta instantánea.
- **6 Eval** recibe la nota final de cada UT calculada en Moodle, de 0–10 con decimales. Una UT vacía cuenta como cero en Media. Las medias y Media final leen en vivo los pesos de Config; Educa de cada evaluación y Educa final se introducen manualmente (1–10 o MH), con semáforo. MEDIA DEL GRUPO resume el grupo. Las recuperaciones se gestionan en Moodle. Tras cambios de Alumnado, selecciona Alumnado y 6 Eval en **Reparar estructura** para sincronizar.

**Dependencias:** Calendario + Horario → Config → Seg y Eval; Alumnado → Eval; ponderaciones de Config → medias de Eval. Seg es una instantánea inicial que luego refleja lo ocurrido, mientras Eval lee los pesos actuales de Config.

## Reparar estructura

El menú **Reparar estructura** abre un selector. Los siete bloques visibles empiezan marcados: Portada, Calendario, Horario, Alumnado, 4 Config, 5 Seg y 6 Eval. Puedes marcar o desmarcar todos. Con ninguno marcado se realiza solo mantenimiento técnico. Al confirmar se comprueban las tablas técnicas, referencias, metadatos, orden y protecciones; solo los bloques elegidos se regeneran. La reparación conserva los datos docentes. Si eliges solo Alumnado, Eval no cambia; si eliges solo Config, Seg y Eval no cambian. Los históricos **5 Seg OLD** solo reciben orden, color de pestaña y aviso de protección. Las protecciones `CUADERNO:` muestran advertencias; tus protecciones manuales permanecen.

## Preparar nuevo curso

**Preparar nuevo curso** es una acción excepcional. Primero crea y verifica una copia completa en la carpeta original. Solo entonces mueve o renombra el cuaderno activo y reinicia datos anuales: alumnado, horario semanal y fechas del calendario. Conserva docente, centro, tema, tramos y actividades; archiva Seguimiento como OLD y elimina Config y Eval anteriores. Después se abre el asistente para revisar el nuevo curso. Si cancelas ese asistente, el curso ya preparado y los pasos guardados siguen disponibles.

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
