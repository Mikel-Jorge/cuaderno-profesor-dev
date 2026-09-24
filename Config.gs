const CP = Object.freeze({
  PROJECT_NAME: 'Cuaderno del Profesor',
  NOTEBOOK_VERSION: '1.0.0',
  SCHEMA_VERSION: '1',
  SHEETS: Object.freeze({
    COVER: '0 Portada',
    CONFIG: '_CONFIG',
    META: '_META',
  }),
  CONFIG_KEYS: Object.freeze({
    ACADEMIC_YEAR: 'curso_academico',
    TEACHER: 'profesor',
    SCHOOL: 'centro',
    SCHOOL_ADDRESS: 'centro_direccion',
    SCHOOL_PHONE: 'centro_telefono',
    SCHOOL_EMAIL: 'centro_email',
    SCHOOL_WEB: 'centro_web',
  }),
  MENU: Object.freeze({
    NAME: '📘 Cuaderno del Profesor 📘',
    INIT: '🔄 Inicializar / reparar estructura',
    CONFIG: '⚙️ Configuración',
    GENERAL_DATA: '👤 Datos generales',
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
    GENERAL_CONFIG_DIALOG_WIDTH: 560,
    GENERAL_CONFIG_DIALOG_HEIGHT: 700,
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
  ACCENT: '#0F766E',
  WHITE: '#FFFFFF',
});
