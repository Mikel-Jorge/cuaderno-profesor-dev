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
      text: 'Revisa el curso académico y los datos que aparecerán en la Portada. Escribe el curso con el formato YYYY-YYYY.',
    },
    {
      id: 'calendar',
      title: 'Calendario',
      text: 'Activa los tipos de enseñanza que impartes y confirma sus periodos y evaluaciones con el calendario de tu centro.',
    },
    {
      id: 'schedule',
      title: 'Horario',
      text: 'Revisa tramos y actividades; después coloca las actividades en la semana. Una sesión cuenta como una hora docente.',
    },
    {
      id: 'students',
      title: 'Alumnado',
      text: 'Anota Apellidos, Nombre y Grupo. Email es opcional. Usa REACA y Medidas cuando corresponda; Medidas se muestra como nota en Eval.',
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
      text: 'Introduce la nota final de cada UT. Revisa las medias calculadas y escribe manualmente las notas Educa. Si llega un alumno nuevo, añádelo en 3 Alumnado y repara solo 6 Eval.',
    },
    {
      id: 'new-course',
      title: 'Preparar nuevo curso',
      text: 'Completa los siete pasos a tu ritmo. El borrador se conserva al cancelar; la copia y el nuevo cuaderno se crean al finalizar.',
    },
    {
      id: 'initialize',
      title: 'Reparar estructura',
      text: 'Marca solo las hojas que necesiten mantenimiento y pulsa Reparar. Tus datos se conservan.',
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
        ['¿Qué hago si llega un alumno nuevo?', 'Añádelo en 3 Alumnado, selecciona su grupo y ejecuta Reparar estructura marcando Hojas 6 Eval. Las Evaluaciones del grupo incorporarán al alumno sin modificar las notas existentes.'],
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
      students: ['👥', 'Identidad, REACA y Medidas', 'alumnado'],
      'module-config': ['📚', 'UT, horas y pesos', 'modulo config peso'],
      'module-tracking': ['📝', 'Registro de lo impartido', 'seguimiento old'],
      evaluation: ['📊', 'Notas, medias y Educa', 'evaluacion eval peso mh'],
      initialize: ['🔧', 'Mantenimiento selectivo', 'reparar protegida'],
      'new-course': ['🆕', 'Copia y preparación anual', 'backup curso'],
      troubleshooting: ['❓', 'Respuestas rápidas', 'faq dudas'],
    }[section.id] || ['', '', ''];
    const bullets = {
      cover: ['Usa el índice para abrir las hojas del cuaderno.'],
      'general-data': ['Actualiza docente y centro cuando cambien.', 'Revisa el curso académico antes de configurar el calendario.'],
      calendar: ['Revisa festivos, Navidad y Semana Santa con el calendario oficial.', 'Indica FEOE y repaso cuando afecten a tus módulos.'],
      schedule: ['Crea los tramos y las actividades antes de asignar sesiones.', 'En un curso nuevo se conservan tramos y actividades; la semana empieza vacía.'],
      students: ['Después de añadir un alumno con grupo, selecciona solo 6 Eval en Reparar estructura para incorporarlo a sus evaluaciones.'],
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
