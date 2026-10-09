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
    contextDescription: getSidebarContextDescription_(contextSectionId),
    themeCss: createUiThemeCss_(getActiveTheme_(spreadsheet, config)),
  };
}

function getSidebarContextDescription_(sectionId) {
  const descriptions = {
    cover: 'Portada e índice del cuaderno', calendar: 'Periodos y fechas del curso',
    schedule: 'Tramos, actividades y sesiones', students: 'Datos del alumnado',
    'module-config': 'Planificación de UT y ponderaciones',
    'module-tracking': 'Seguimiento de las sesiones',
    evaluation: 'Calificaciones y notas Educa',
  };
  return descriptions[sectionId] || 'Hoja no gestionada por el Cuaderno.';
}

function getSidebarStateItems_(config) {
  const generalDataComplete = [
    CP.CONFIG_KEYS.ACADEMIC_YEAR,
    CP.CONFIG_KEYS.TEACHER,
    CP.CONFIG_KEYS.SCHOOL,
  ].every(function(key) {
    return Boolean(normalizeConfigValue_(config[key]));
  });
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
      text: 'Prepara el curso, completa Alumnado, crea 4 Config de cada módulo, define UT y ponderaciones, recalcula, crea Seg y Eval, y trabaja durante el curso.',
    },
    {
      id: 'dependencies',
      title: '¿Qué depende de qué?',
      text: 'Calendario + Horario → 4 Config → 5 Seg y 6 Eval. Alumnado → 6 Eval. Los pesos de 4 Config → medias de 6 Eval en vivo. Seg nace como instantánea de la planificación y después refleja la realidad: no se resincroniza con Config.',
    },
    {
      id: 'cover',
      title: 'Portada',
      text: 'Resume los datos del curso y ofrece un índice para navegar por las hojas visibles del cuaderno.',
    },
    {
      id: 'general-data',
      title: 'Configuración general',
      text: 'Cuaderno del Profesor → Configuración general guarda curso académico, docente y centro. El tema se puede revisar en el asistente. El curso académico usa YYYY-YYYY.',
    },
    {
      id: 'calendar',
      title: 'Calendario',
      text: 'Cuaderno del Profesor → Configurar calendario: activa tipos de enseñanza, periodos y evaluaciones; revisa festivos y otras fechas especiales, Navidad y Semana Santa. Los festivos y periodos no lectivos reducen las sesiones disponibles. FEOE es el periodo de formación en empresa y excluye sesiones reales del módulo; repaso permanece configurable. Contrasta las propuestas con el calendario oficial del centro.',
    },
    {
      id: 'schedule',
      title: 'Horario',
      text: 'Cuaderno del Profesor → Configurar horario: crea tramos consecutivos, actividades con sigla y grupo, y asigna la cuadrícula de lunes a viernes. MODULO identifica las imparticiones; el apoyo se indica en cada asignación. Una sesión equivale a una hora docente. En un curso nuevo se conservan tramos y actividades, pero se vacían las asignaciones semanales.',
    },
    {
      id: 'students',
      title: 'Alumnado',
      text: 'Introduce Apellidos, Nombre y Grupo en 3 Alumnado; Email es opcional. REACA es un checkbox y Medidas es texto que aparece como nota en Eval. El Cuaderno mantiene una identidad interna para no mezclar notas al ordenar. Tras altas o cambios, marca Alumnado y 6 Eval en Reparar estructura para sincronizar.',
    },
    {
      id: 'module-config',
      title: 'Config de módulos',
      text: 'Módulos → Crear configuración ofrece actividades MODULO con sesiones reales y calendario. Cada módulo + grupo es independiente. Define UT, nombre, horas, color y Peso; la evaluación se asigna por el último día de la UT. Las horas se reparten cronológicamente. El resumen muestra disponibles, pendientes, Peso UTs y Peso final. Usa Módulos → Recalcular para aplicar la planificación; el aviso indica cambios pendientes. Si se borra Config, las UT de esa hoja se pierden.',
    },
    {
      id: 'module-tracking',
      title: 'Seguimiento',
      text: '5 Seg parte de una instantánea de la planificación. Fecha y Total son derivados; puedes cambiar UT, Plan previsto, Actividades realizadas, Actual y Mejoras. Acum. suma por UT aunque esté intercalada. Rojo indica exceso respecto al total inicial y amarillo en Mejoras indica una propuesta. Registra lo que ocurrió; Config no reescribe el histórico. OLD conserva el curso anterior.',
    },
    {
      id: 'evaluation',
      title: 'Evaluación',
      text: '6 Eval recibe notas UT de 0–10 con decimales; vacío cuenta como cero en Media. Los pesos de Config actualizan en vivo las medias y Media final. Educa por evaluación y Educa final son manuales (1–10 o MH); MH equivale a diez al calcular MEDIA DEL GRUPO. El semáforo ayuda a leer Educa; Medidas/REACA aparecen como nota. Las notas permanecen asociadas al alumno aunque se ordene o desaparezca de Alumnado. Las recuperaciones se gestionan en Moodle.',
    },
    {
      id: 'new-course',
      title: 'Preparar nuevo curso',
      text: 'Cuaderno del Profesor → Preparar nuevo curso crea y verifica primero un backup. Conserva docente, centro, tema, tramos y actividades; archiva 5 Seg como OLD, elimina Config y Eval, limpia Alumnado, horario semanal y fechas anuales. Después abre el asistente. Cancelar el asistente conserva los pasos ya guardados.',
    },
    {
      id: 'initialize',
      title: 'Reparar estructura',
      text: 'Cuaderno del Profesor → Reparar estructura permite elegir bloques visibles. Todos están marcados al abrir; sin marcas solo comprueba la estructura técnica. Si solo falla Evaluación, marca únicamente Hojas 6 Eval. Conserva datos docentes y no reinicia el curso. Algunas celdas calculadas muestran un aviso de protección al editar: puedes continuar si sabes lo que haces. Las protecciones manuales permanecen.',
    },
    {
      id: 'troubleshooting',
      title: 'Preguntas frecuentes',
      text: 'Respuestas breves a los casos más habituales.',
      faqs: [
        ['¿Por qué no aparece un módulo al crear Config?', 'Comprueba que la actividad es MODULO, tiene grupo y sesiones lectivas en Calendario y Horario. Las referencias huérfanas se limpian al abrir Crear configuración.'],
        ['¿Por qué no aparece al crear Seg y Eval?', 'Completa 4 Config, recalcula la planificación y revisa UT y ponderaciones.'],
        ['¿Qué pasa si borro 4 Config?', 'La definición de UT en esa hoja se pierde. El registro se sanea y podrás crearla de nuevo; consulta el backup para recuperar datos.'],
        ['¿Qué pasa si borro 6 Eval?', 'Reparar estructura puede recrearla; las notas borradas solo sobreviven en el backup.'],
        ['¿Puedo cambiar la UT en Seguimiento?', 'Sí. Seguimiento refleja lo que ocurrió realmente y Acum. sigue la UT elegida.'],
        ['¿Por qué una UT vacía cuenta como cero?', 'Es la regla de cálculo de la media del grupo en Evaluación.'],
        ['¿Qué es MH?', 'Matrícula de Honor. Se muestra como MH y equivale a diez cuando se calcula una media.'],
        ['¿Qué significa OLD?', 'Es un Seguimiento histórico del curso anterior, que no se resincroniza.'],
        ['¿Por qué sigue un alumno ausente en Eval?', 'Las notas existentes nunca se borran automáticamente aunque deje de aparecer en Alumnado.'],
        ['¿Qué hago si una fórmula parece rota?', 'Marca el bloque correspondiente en Reparar estructura. Eval conserva las notas si detecta una estructura de UT incompatible.'],
        ['¿Por qué Sheets avisa de una celda protegida?', 'Es una advertencia para evitar cambios accidentales en celdas derivadas. Puedes continuar si sabes lo que haces.'],
        ['¿Cambiar Config cambia Seguimiento?', 'No. Seg conserva la instantánea capturada al crearse.'],
        ['¿Cambiar pesos de Config cambia Eval?', 'Sí. Las medias de Eval leen los pesos actuales de Config.'],
        ['¿Qué es FEOE?', 'Es el periodo de formación en empresa, que reduce las sesiones lectivas disponibles del módulo.'],
        ['¿Qué ocurre si cambio Config?', 'Recalcula para aplicar los cambios de planificación. Seguimiento conserva su registro y Eval actualiza sus medias desde los pesos vigentes.'],
        ['¿Qué es el Peso de UT y el Peso final?', 'Peso de UT pondera cada unidad dentro de su evaluación; Peso final pondera las evaluaciones en la media final.'],
        ['¿Qué hace Reparar estructura?', 'Comprueba y repara los bloques seleccionados, conservando los datos del cuaderno.'],
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
    let text = section.text;
    if (section.id === 'first-steps') text = 'Prepara el curso, completa Alumnado, crea 4 Config de cada módulo, define UT y ponderaciones, recalcula y crea Seguimiento y Evaluación. Después registra las sesiones y notas.';
    if (section.id === 'general-data') text = 'Cuaderno del Profesor → Configuración → Configuración general guarda curso académico, docente, centro y Theme. El curso usa YYYY-YYYY.';
    if (section.id === 'calendar') text = text.replace('Cuaderno del Profesor → Configurar calendario', 'Cuaderno del Profesor → Configuración → Calendario');
    if (section.id === 'schedule') text = text.replace('Cuaderno del Profesor → Configurar horario', 'Cuaderno del Profesor → Configuración → Horario');
    if (section.id === 'new-course') text = 'Cuaderno del Profesor → Preparar nuevo curso abre un único proceso guiado: copia verificada, datos generales, calendario, tramos, actividades, horario y resumen. Conserva docente, centro, tema, tramos y actividades; guarda Seguimiento como OLD y reinicia datos anuales. Los pasos guardados permanecen si cancelas.';
    if (section.id === 'initialize') text = 'Cuaderno del Profesor → Reparar estructura permite elegir las hojas que necesitan mantenimiento. Los datos docentes se conservan. Puedes seleccionar todo o solo el bloque afectado.';
    return {
      id: section.id,
      title: section.id === 'module-config' ? 'Módulos / 4 Config' : section.title,
      text: text,
      icon: presentation[0],
      subtitle: presentation[1],
      keywords: presentation[2],
      faqs: section.faqs || [],
      open: section.id === contextSectionId,
    };
  });
}
