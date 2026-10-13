function abrirPanelLateral() {
  const template = HtmlService.createTemplateFromFile('UiSidebar');
  template.sidebarData = getSidebarData_();
  setCommonUiTemplateData_(template);

  const output = template.evaluate().setTitle(CP.PROJECT_NAME);
  SpreadsheetApp.getUi().showSidebar(output);
}

function obtenerDatosPanelLateral() {
  return getSidebarData_();
}

function getSidebarData_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const config = getGeneralConfigValues_(spreadsheet);
  const activeSheet = spreadsheet.getActiveSheet();
  const contextSectionId = getSidebarContextSectionId_(activeSheet);

  return {
    stateItems: getSidebarStateItems_(config),
    helpSections: getSidebarHelpSections_(contextSectionId),
    feedbackFormUrl: CP.FEEDBACK_FORM_URL,
    contextSectionId: contextSectionId,
    activeSheetName: activeSheet ? activeSheet.getName() : '',
    themeCss: createUiThemeCss_(getActiveTheme_(spreadsheet, config)),
  };
}

function getSidebarStateItems_(config) {
  const generalDataComplete = getGeneralConfigCompletion_(config).complete;
  const calendarConfigured = isCalendarConfiguredForSidebar_();
  const scheduleConfigured = isScheduleConfiguredForSidebar_();
  const studentsConfigured = isStudentsConfiguredForSidebar_();

  const items = [
    {
      label: 'Datos generales',
      status: generalDataComplete ? 'complete' : 'pending',
      statusLabel: generalDataComplete ? 'Completados' : 'Pendientes',
    },
    {
      label: 'Calendario',
      status: calendarConfigured ? 'complete' : 'pending',
      statusLabel: calendarConfigured ? 'Configurado' : 'Pendiente',
    },
    {
      label: 'Horario',
      status: scheduleConfigured ? 'complete' : 'pending',
      statusLabel: scheduleConfigured ? 'Configurado' : 'Pendiente',
    },
    {
      label: 'Alumnado',
      status: studentsConfigured ? 'complete' : 'pending',
      statusLabel: studentsConfigured ? 'Configurado' : 'Pendiente',
    },
  ];
  const moduleStatuses = getModuleConfigurationStatuses_();
  if (!moduleStatuses.length) {
    items.push({
      label: 'Configuración de módulos',
      status: 'pending',
      statusLabel: 'Sin módulos en Horario',
    });
  } else {
    moduleStatuses.forEach(function(item) {
      items.push({
        label: 'Config · ' + item.label,
        status: item.status,
        statusLabel: item.statusLabel,
      });
      if (item.hasConfig) {
        items.push({
          label: 'Seg/Eval · ' + item.label,
          status: item.consumersComplete ? 'complete' : 'pending',
          statusLabel: item.consumersComplete ? 'Creados' : 'Pendientes',
        });
      }
    });
  }
  return items;
}

function getSidebarContextSectionId_(sheet) {
  const sheetName = sheet && sheet.getName();
  const sectionBySheet = {};
  sectionBySheet[CP.SHEETS.COVER] = 'cover';
  sectionBySheet[CP.SHEETS.CALENDAR] = 'calendar';
  sectionBySheet[CP.SHEETS.SCHEDULE] = 'schedule';
  sectionBySheet[CP.SHEETS.STUDENTS] = 'students';
  if (getModuleConfigActivityIdForSheet_(sheet)) return 'module-config';
  if (sheet && getManagedProtectionKind_(sheet) === 'EVALUATION') return 'evaluation';
  if (getModuleConsumerActivityIdForSheet_(sheet)) return 'module-tracking';
  return sectionBySheet[sheetName] || 'first-steps';
}

function getSidebarHelpSections_(contextSectionId) {
  const sections = [
    {
      id: 'first-steps',
      title: 'Primeros pasos',
      text: '',
    },
    {
      id: 'dependencies',
      title: '¿Qué depende de qué?',
      text: 'Sigue este orden para que las sesiones, las unidades y las notas aparezcan donde corresponden.',
    },
    {
      id: 'cover',
      title: 'Portada',
      text: 'Resume los datos del curso y ofrece un índice para navegar por las hojas visibles del cuaderno.',
    },
    {
      id: 'general-data',
      title: 'Datos del docente y centro',
      text: 'Revisa el curso académico y los datos que aparecerán en la Portada. Escribe el curso con el formato YYYY-YYYY. Si eres tutor/a, indica también el grupo de tutoría.',
    },
    {
      id: 'calendar',
      title: 'Calendario',
      text: 'Activa los tipos de enseñanza que impartes y confirma sus periodos y evaluaciones con el calendario de tu centro.',
    },
    {
      id: 'schedule',
      title: 'Horario',
      text: 'Revisa tramos y actividades; después coloca las actividades en la semana. Las actividades institucionales se proponen una vez por curso. Una sesión cuenta como una hora docente.',
    },
    {
      id: 'students',
      title: 'Alumnado',
      text: 'Importa Apellidos, Nombre y Grupo desde Alumnado → Importar alumnado de módulos o, si eres tutor/a, desde Alumnado → Importar grupo de tutoría. Las columnas de identidad están protegidas. En 3 Alumnado puedes completar Email y editar REACA e Información / Medidas. El informe EDUCA no incluye Email. Solo el importador de módulos actualiza matrículas y Evaluaciones existentes.',
    },
    {
      id: 'educa-import',
      title: 'Importar alumnado de módulos',
      text: 'En EDUCA abre Alumnado → Informes → Listado mi alumnado → Por profesor → Excel → Asignatura → Mostrar todas las asignaturas. Selecciona todas, también «(Centro)», y descarga el archivo sin modificarlo. El Cuaderno une ambas variantes porque EDUCA puede repartir el alumnado entre ellas. Si el nombre del grupo difiere, selecciona manualmente el módulo correcto: al importar se actualizarán el Grupo del módulo y el del alumnado reconocido con el valor de EDUCA. El archivo se procesa para importar y no se guarda como archivo en Drive. El informe no incluye correo electrónico: completa después Email en 3 Alumnado. Este importador solo incluye alumnado de módulos, no el grupo completo de Tutoría.',
    },
    {
      id: 'tutor-import',
      title: 'Importar grupo de tutoría',
      text: 'Solo aparece al marcar Soy tutor/a en Configuración → Datos del docente y centro. En EDUCA sigue Alumnado → Informes → Listado mi alumnado → pestaña «Por grupo» → Tipo «Excel» → grupo de tutoría → «Todos los alumnos» → «Enviar». Analiza el archivo sin modificarlo y revisa los Email de todo el grupo: los conocidos en 3 Alumnado aparecen precargados y puedes corregirlos. Importar permanece disponible; al pulsarlo, el Cuaderno marca los Email vacíos o incorrectos y lleva al primero antes de enviar el archivo. El valor final se guarda en 3 Alumnado. Los alumnos exclusivos de Tutoría quedan en 3 Alumnado y en el roster, pero no adquieren matrículas ni filas de Eval sin matrícula real. Cada curso debes importar de nuevo el grupo completo.',
    },
    {
      id: 'module-enrollments',
      title: 'Matrículas de módulos',
      text: 'Grupo indica el grupo general del alumno; la matrícula indica qué módulos concretos cursa. Para matricular o desmatricular, abre Alumnado → Matrículas de módulos, marca o desmarca y guarda. Si existe 6 Eval, la evaluación se actualiza automáticamente: las bajas conservan notas en una fila gris y las altas recuperan su fila. Los cambios manuales tienen prioridad sobre futuras importaciones de EDUCA.',
    },
    {
      id: 'google-contacts',
      title: 'Google Contacts',
      text: 'Abre Alumnado → Sincronizar Google Contacts: el análisis empieza automáticamente y puedes revisar la vista previa antes de pulsar Sincronizar. Google puede solicitar permiso para gestionar tus contactos. El Cuaderno crea o reutiliza contactos por Email. Nunca elimina contactos. Gestiona etiquetas de módulo como «2627 · DAM 2A · PMDM» y, solo tras importar el grupo completo de Tutoría, su etiqueta general «2627 · DAM 2A». No crea etiquetas generales para otros grupos. Ambas familias son independientes. Tras la primera sincronización manual de cada curso, guardar Matrículas o importar EDUCA actualiza automáticamente las etiquetas de los módulos afectados. Un Email editado directamente en 3 Alumnado se incorpora a Tutoría al reimportar su grupo o sincronizar Contacts manualmente. Las etiquetas de cursos anteriores permanecen.',
    },
    {
      id: 'module-config',
      title: 'Config de módulos',
      text: 'Crea una Config para cada módulo y grupo que ya tenga sesiones. Define las UT, sus horas y sus pesos; recalcula cuando cambies la planificación.',
    },
    {
      id: 'module-tracking',
      title: 'Seguimiento',
      text: 'Registra lo impartido realmente: UT, actividades realizadas, horas y mejoras. Los Seguimientos OLD conservan cursos anteriores.',
    },
    {
      id: 'evaluation',
      title: 'Evaluación',
      text: 'La columna C de 6 Eval muestra REACA y conserva Información / Medidas como Note contextual. Introduce la nota final de cada UT. Revisa las medias calculadas y escribe manualmente las notas Educa. Si falta un alumno en una Evaluación, revisa primero Alumnado → Matrículas de módulos. Si ya aparece en 3 Alumnado, basta con matricularlo y guardar: 6 Eval se actualiza automáticamente. Desmarcarlo conserva sus notas en una fila histórica gris protegida; si vuelve a matricularse, recupera la misma fila y sus datos.',
    },
    {
      id: 'new-course',
      title: 'Preparar nuevo curso',
      text: 'Completa los siete pasos a tu ritmo. Si eres tutor/a, marca Soy tutor/a e indica el Grupo de tutoría en Datos del docente y centro; no crees Tutoría en Actividades. El borrador se conserva al cancelar; la copia y el nuevo cuaderno se crean al finalizar.',
    },
    {
      id: 'initialize',
      title: 'Reparar estructura',
      text: 'Reparar estructura sirve para mantenimiento y recuperación de fórmulas, formatos y protecciones. Importar alumnado y guardar Matrículas actualizan Eval directamente; no necesitas Reparar para altas o bajas habituales.',
    },
    {
      id: 'troubleshooting',
      title: 'Preguntas frecuentes',
      text: '',
      faqs: [
        ['¿Por qué no aparece un módulo al crear Config?', 'Comprueba que la actividad es un módulo, tiene grupo y figura en un horario lectivo.'],
        ['¿Por qué no aparece al crear Seg y Eval?', 'Completa 4 Config, recalcula la planificación y revisa UT y ponderaciones.'],
        ['¿Qué pasa si borro 4 Config?', 'Se pierden las UT de esa hoja. Podrás crearla de nuevo; consulta una copia de seguridad si necesitas recuperar los datos.'],
        ['¿Qué pasa si borro 6 Eval?', 'Reparar estructura puede recrearla; las notas borradas solo sobreviven en el backup.'],
        ['¿Puedo cambiar la UT en Seguimiento?', 'Sí. Seguimiento refleja lo que ocurrió realmente y Acum. sigue la UT elegida.'],
        ['¿Por qué una UT vacía cuenta como cero?', 'Es la regla de cálculo de la media del grupo en Evaluación.'],
        ['¿Qué es MH?', 'Matrícula de Honor. Se muestra como MH y equivale a diez cuando se calcula una media.'],
        ['¿Qué significa OLD?', 'Es un Seguimiento histórico del curso anterior, que no se resincroniza.'],
        ['¿Por qué sigue un alumno ausente en Eval?', 'Las notas anteriores se conservan aunque esa persona deje de aparecer en Alumnado.'],
        ['¿Por qué no se importan los correos de los módulos?', 'El informe «Listado mi alumnado» de EDUCA no incluye el correo electrónico. Tras importar módulos, completa Email en 3 Alumnado. Al importar Tutoría puedes revisar y completar todos los Email en la pantalla intermedia.'],
        ['¿Qué ocurre si vuelvo a importar el Excel?', 'No duplica alumnos existentes y conserva Email, REACA e Información / Medidas. Actualiza el Grupo con el dato de EDUCA y las matrículas gestionadas por el informe. Los cambios manuales en Matrículas de módulos tienen prioridad: si desmatriculaste a un alumno, reimportar no lo matriculará otra vez. Nadie se borra de Alumnado ni pierde sus notas.'],
        ['¿Por qué no acepta mi archivo?', 'El importador está diseñado solo para Listado mi alumnado → Por profesor → Excel → Asignatura de EDUCA, no para cualquier Excel.'],
        ['¿Por qué tengo que revisar los correos de Tutoría?', 'El informe «Por grupo» de EDUCA no incluye el correo electrónico. El Cuaderno precarga los Email ya disponibles en 3 Alumnado y te pide completar o corregir los restantes antes de crear la etiqueta de Google Contacts.'],
        ['¿Qué ocurre si un alumno deja mi grupo de Tutoría?', 'Vuelve a importar el informe actualizado. El alumno permanece en 3 Alumnado y conserva matrículas y notas; deja de estar activo en Tutoría y se retira únicamente de la etiqueta general del grupo.'],
        ['¿Qué pasa si corrijo un Email durante la importación de Tutoría?', 'El nuevo Email se guarda en 3 Alumnado y se usa para Google Contacts. El Cuaderno no borra contactos anteriores asociados a otros correos.'],
        ['¿Qué hago si llega un nuevo alumno?', 'Descarga de nuevo el informe actualizado de EDUCA e impórtalo desde Alumnado → Importar alumnado de módulos. Revisa Matrículas de módulos si necesitas una excepción y completa su Email manualmente. Si ya existe 6 Eval, se incorporará automáticamente cuando esté matriculado.'],
        ['¿Qué ocurre si un alumno no tiene Email?', 'En módulos puede permanecer sin Email y no se sincroniza su contacto; el resto puede sincronizarse. Para importar el grupo de Tutoría debes completar un Email válido para cada alumno.'],
        ['¿Qué ocurre si ya tengo a ese alumno en Google Contacts?', 'Si existe un único contacto con el mismo correo, el Cuaderno lo reutiliza sin cambiar sus datos personales.'],
        ['¿El Cuaderno puede borrar mis contactos?', 'No. La sincronización no elimina contactos de Google Contacts; solo crea los que faltan y actualiza las etiquetas gestionadas por el Cuaderno.'],
        ['¿Qué hago si una media parece incorrecta?', 'Revisa las notas y los pesos de Config. Si la hoja tiene un problema de formato o cálculo, selecciona su bloque en Reparar estructura.'],
        ['¿Por qué Sheets avisa de una celda protegida?', 'Es una advertencia para evitar cambios accidentales en celdas derivadas. Puedes continuar si sabes lo que haces.'],
        ['¿Cambiar Config cambia Seguimiento?', 'No. Seg conserva la instantánea capturada al crearse.'],
        ['¿Cambiar pesos de Config cambia Eval?', 'Sí. Las medias de Eval leen los pesos actuales de Config.'],
        ['¿Qué es FEOE?', 'Es el periodo de formación en empresa, que reduce las sesiones lectivas disponibles del módulo.'],
        ['¿Qué ocurre si cambio Config?', 'Recalcula para aplicar los cambios de planificación. Seguimiento conserva su registro y Eval actualiza sus medias desde los pesos vigentes.'],
        ['¿Qué es el Peso de UT y el Peso final?', 'Peso de UT pondera cada unidad dentro de su evaluación; Peso final pondera las evaluaciones en la media final.'],
        ['¿Qué hace Reparar estructura?', 'Actualiza las hojas seleccionadas y conserva sus datos.'],
        ['¿Qué conserva Preparar nuevo curso?', 'Conserva docente, centro, tema, tramos y actividades. Guarda Seguimiento como OLD; reinicia Alumnado, sesiones semanales y fechas anuales.'],
      ],
    },
  ];

  return sections.sort(function(first, second) {
    if (first.id === contextSectionId) {
      return -1;
    }
    if (second.id === contextSectionId) {
      return 1;
    }
    return 0;
  }).map(function(section) {
    const presentation = {
      'first-steps': ['🚀', 'Empieza por el curso y sigue el orden recomendado', 'curso inicio preparar'],
      dependencies: ['↳', 'Cómo se relacionan las hojas', 'dependencias pesos'],
      cover: ['🏠', 'Índice y datos del curso', 'portada'],
      'general-data': ['⚙️', 'Docente, centro y apariencia', 'tema profesor'],
      calendar: ['📅', 'Periodos, evaluaciones y fechas', 'feoe festivos navidad'],
      schedule: ['🕒', 'Tramos, actividades y semana', 'horario apoyo'],
      students: ['👥', 'Identidad, REACA e Información / Medidas', 'alumnado'],
      'educa-import': ['📥', 'Informe Excel XLS por profesor y asignatura', 'educa importar módulos importar modulos alumnado excel xls centro correo email'],
      'tutor-import': ['📥', 'Grupo completo de Tutoría y correos', 'educa tutoria grupo tutoria importar grupo por grupo xls email correo'],
      'module-enrollments': ['👥', 'Pertenencia a cada módulo', 'matricula matriculas modulo grupo'],
      'google-contacts': ['📇', 'Contactos y etiquetas del curso', 'google contacts contacto correo email etiqueta grupo modulo tutoría'],
      'module-config': ['📚', 'UT, horas y pesos', 'modulo config peso'],
      'module-tracking': ['📝', 'Registro de lo impartido', 'seguimiento old'],
      evaluation: ['📊', 'Notas, medias y Educa', 'evaluacion evaluación eval peso mh REACA medidas'],
      initialize: ['🔧', 'Mantenimiento selectivo', 'reparar protegida'],
      'new-course': ['🆕', 'Copia y preparación anual', 'backup curso'],
      troubleshooting: ['❓', 'Respuestas rápidas', 'faq dudas'],
    }[section.id] || ['', '', ''];
    const bullets = {
      cover: ['Usa el índice para abrir las hojas del cuaderno.'],
      'general-data': ['Actualiza docente y centro cuando cambien.', 'Revisa el curso académico antes de configurar el calendario.'],
      calendar: ['Revisa festivos, Navidad y Semana Santa con el calendario oficial.', 'Indica FEOE y repaso cuando afecten a tus módulos.'],
      schedule: ['Crea los tramos y las actividades antes de asignar sesiones.', 'En un curso nuevo se conservan tramos y actividades; la semana empieza vacía.'],
      students: ['3 Alumnado reúne al alumnado de módulos y al grupo completo de Tutoría, incluso si alguien no cursa módulos del docente. Tras cada importación se ordena por Grupo, Apellidos y Nombre, con separación visual entre grupos.', 'Completa Email manualmente y edita REACA e Información / Medidas en 3 Alumnado.'],
      'educa-import': ['Abre Alumnado → Importar alumnado de módulos y analiza el archivo antes de confirmar.', 'Comprueba el destino de cada asignatura y las posibles bajas de matrícula.'],
      'tutor-import': ['Descarga Por grupo → Todos los alumnos y analiza el XLS sin modificarlo.', 'Revisa todos los Email; se precargan los existentes y puedes corregirlos.', 'Tutoría mantiene un roster anual y no cambia matrículas de módulos.'],
      'module-enrollments': ['Marca solo los alumnos que cursan el módulo y guarda.', 'Una baja conserva el alumno y sus notas, que quedan como histórico en Eval.'],
      'google-contacts': ['Al abrir Google Contacts se analiza automáticamente; revisa la vista previa y pulsa Sincronizar.', 'Los alumnos sin Email o con Email inválido se omiten; los contactos ambiguos requieren revisión.', 'Las etiquetas de módulo reflejan las matrículas actuales. Después de la primera sincronización manual del curso, Matrículas y EDUCA las actualizan automáticamente.'],
      'module-config': ['Cada módulo + grupo se configura por separado.', 'Las UT se sitúan en la evaluación donde terminan. Si borras Config, se pierden sus UT.'],
      'module-tracking': ['Fecha y Total se calculan automáticamente.', 'Los cambios posteriores de Config no reescriben lo ya registrado en Seg.'],
      evaluation: ['Las notas UT admiten 0–10 con decimales; una casilla vacía cuenta como cero en la media.', 'Los pesos de Config actualizan las medias. Educa admite 1–10 o MH.', 'Las recuperaciones se gestionan en Moodle.'],
      'new-course': ['Atrás permite revisar pasos visitados; Siguiente guarda el paso actual.', 'Al finalizar se crea la copia antes de preparar el curso.', 'Puedes terminar con pasos pendientes y completarlos más tarde.'],
      initialize: ['Todos los bloques aparecen marcados al abrir; desmarca los que no necesites.', 'Si Sheets avisa al editar una celda protegida, comprueba antes si es un cálculo del cuaderno.'],
    }[section.id] || [];
    return {
      id: section.id,
      title: section.id === 'module-config' ? 'Módulos / 4 Config' : section.title,
      text: section.text,
      bullets: bullets,
      icon: presentation[0],
      subtitle: presentation[1],
      keywords: presentation[2],
      faqs: section.faqs || [],
      open: section.id === contextSectionId,
    };
  });
}
