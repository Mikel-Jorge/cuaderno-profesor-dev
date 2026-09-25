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
  const contextSectionId = getSidebarContextSectionId_(activeSheet && activeSheet.getName());

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

  return [
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
    { label: 'Horario', status: 'unavailable', statusLabel: 'No disponible todavía' },
    { label: 'Módulos', status: 'unavailable', statusLabel: 'No disponible todavía' },
    { label: 'Alumnado', status: 'unavailable', statusLabel: 'No disponible todavía' },
  ];
}

function getSidebarContextSectionId_(sheetName) {
  const sectionBySheet = {};
  sectionBySheet[CP.SHEETS.COVER] = 'cover';
  sectionBySheet[CP.SHEETS.CALENDAR] = 'calendar';
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
      text: 'Guarda el curso académico, el profesor, el centro y la apariencia. Los cambios actualizan la portada.',
    },
    {
      id: 'calendar',
      title: 'Calendario',
      text: 'Muestra el curso académico de agosto a julio desde los datos estructurados. Los colores son solo representación visual.',
    },
    {
      id: 'new-course',
      title: 'Preparar nuevo curso',
      text: 'Permite revisar curso, profesor, centro y apariencia, crear una copia de seguridad y elegir una carpeta de Mi unidad. Calendario y horario se incorporarán cuando esas áreas estén disponibles.',
    },
    {
      id: 'initialize',
      title: 'Inicializar / reparar',
      text: 'Comprueba la estructura base, reaplica la portada y actualiza el índice sin eliminar la configuración guardada.',
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
