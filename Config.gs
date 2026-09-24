const CP = Object.freeze({
  PROJECT_NAME: 'Cuaderno del Profesor',
  NOTEBOOK_VERSION: '1.0.0',
  SCHEMA_VERSION: '1',
  ENVIRONMENT: 'DEV',
  SHEETS: Object.freeze({
    COVER: '0 Portada',
    CONFIG: '_CONFIG',
    META: '_META',
  }),
  MENU: Object.freeze({
    NAME: '📘 Cuaderno del Profesor 📘',
    INIT: '🔄 Inicializar / reparar estructura',
    HELP: '❓ Ayuda',
  }),
  UI: Object.freeze({
    AUTHOR: 'Mikel Aingeru Jorge Soteras',
    AUTHOR_EMAIL: 'mjorgesote@educacion.navarra.es',
    INIT_CONFIRMATION_ID: 'confirm-initialize-notebook',
    INIT_PROCESS_ID: 'initialize-notebook',
    INIT_ACTION_ID: 'open-initialize-progress',
    CONFIRMATION_DIALOG_WIDTH: 460,
    CONFIRMATION_DIALOG_HEIGHT: 430,
    PROGRESS_DIALOG_WIDTH: 480,
    PROGRESS_DIALOG_HEIGHT: 560,
    CONFIRMATION_VARIANTS: Object.freeze({
      NORMAL: 'normal',
      WARNING: 'warning',
      DANGER: 'danger',
    }),
  }),
});

const CP_COLORS = Object.freeze({
  DARK: '#1F2937',
  PRIMARY: '#2563EB',
  PRIMARY_LIGHT: '#DBEAFE',
  MUTED: '#F3F4F6',
  BORDER: '#CBD5E1',
  DEV: '#F97316',
  WHITE: '#FFFFFF',
});
