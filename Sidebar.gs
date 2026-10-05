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
    themeCss: createUiThemeCss_(getActiveTheme_(spreadsheet, config)),
  };
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
  if (getModuleConsumerActivityIdForSheet_(sheet)) return 'module-tracking';
  return sectionBySheet[sheetName] || 'first-steps';
}

function getSidebarHelpSections_(contextSectionId) {
  const sections = [
    {
      id: 'first-steps',
      title: 'Primeros pasos',
      text: 'Completa los datos generales y revisa la portada. El estado superior indica qué partes están listas.',
    },
    {
      id: 'cover',
      title: 'Portada',
      text: 'Resume los datos del curso y ofrece un índice para navegar por las hojas visibles del cuaderno.',
    },
    {
      id: 'general-data',
      title: 'Datos generales',
      text: 'Guarda el curso académico, el profesor y el centro. La apariencia se elige al preparar un nuevo curso.',
    },
    {
      id: 'calendar',
      title: 'Calendario',
      text: 'Muestra septiembre-junio desde los datos estructurados. Al preparar curso se proponen festivos y vacaciones editables; compruébalos con el calendario de tu centro.',
    },
    {
      id: 'schedule',
      title: 'Horario',
      text: 'Muestra la semana actual de lunes a viernes y la siguiente durante el fin de semana. El día y el tramo actuales se actualizan con fórmulas de la hoja.',
    },
    {
      id: 'students',
      title: 'Alumnado',
      text: 'Introduce el alumnado una sola vez en esta hoja e indica su grupo. La futura Evaluación seleccionará por grupo; el email es opcional.',
    },
    {
      id: 'module-config',
      title: 'Configuración de módulo',
      text: 'Cada módulo y grupo se configura por separado. Define UT, nombre, color, horas manuales y evaluación; después usa Módulos → Recalcular. Horas son sesiones docentes, no minutos. El aviso indica cambios aún no aplicados. Un día mixto contiene varias UT. Compara siempre horas previstas con sesiones reales disponibles.',
    },
    {
      id: 'module-tracking',
      title: 'Seguimiento del módulo',
      text: 'Es un snapshot de la planificación al crearlo. Actualiza UT, Plan previsto, Actividades realizadas, Actual y Mejoras para reflejar lo ocurrido; los cambios posteriores de 4 Config no lo reconstruyen.',
    },
    {
      id: 'new-course',
      title: 'Preparar nuevo curso',
      text: 'Tras verificar el backup, conserva profesor, centro, tema, tramos y actividades; archiva 5 Seg como OLD, elimina 4 Config y 6 Eval del curso anterior y limpia Alumnado, asignaciones y datos anuales del calendario.',
    },
    {
      id: 'initialize',
      title: 'Inicializar / reparar',
      text: 'Comprueba la estructura base, repara Alumnado sin borrar sus filas, ordena las hojas gestionadas y actualiza el índice.',
    },
    {
      id: 'appearance',
      title: 'Temas y apariencia',
      text: 'El tema elegido se aplica a la portada y a la interfaz. Los colores personalizados se conservan en la configuración.',
    },
    {
      id: 'troubleshooting',
      title: 'Problemas frecuentes',
      text: 'Si falta una hoja o la portada no refleja los datos, ejecuta Inicializar / reparar estructura y vuelve a abrir este panel.',
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
    return {
      id: section.id,
      title: section.title,
      text: section.text,
      open: section.id === contextSectionId,
    };
  });
}
