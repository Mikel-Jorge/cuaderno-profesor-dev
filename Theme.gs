const CP_DEFAULT_THEME_PRESET = 'claro-azul';

const CP_THEME_PRESETS = Object.freeze({
  'claro-azul': createThemePreset_(
    'claro-azul',
    'Claro azul',
    '#1D4ED8', '#0F766E', '#B45309', '#F8FAFC', '#FFFFFF',
    '#172033', '#64748B', '#E8EEF6', '#CBD5E1', '#13795B', '#B54708', '#B42318'
  ),
  'claro-verde': createThemePreset_(
    'claro-verde',
    'Claro verde',
    '#166534', '#155E75', '#A16207', '#F7FAF8', '#FFFFFF',
    '#17251D', '#5F6F65', '#E4EFE8', '#B9CCC0', '#13795B', '#B54708', '#B42318'
  ),
  'oscuro-azul': createThemePreset_(
    'oscuro-azul',
    'Oscuro azul',
    '#2563EB', '#0F766E', '#B45309', '#0F172A', '#1E293B',
    '#F8FAFC', '#CBD5E1', '#334155', '#475569', '#34D399', '#B54708', '#F87171'
  ),
  'oscuro-verde': createThemePreset_(
    'oscuro-verde',
    'Oscuro verde',
    '#15803D', '#0E7490', '#A16207', '#102019', '#172B22',
    '#F2F8F4', '#B7C8BE', '#294638', '#466656', '#34D399', '#B54708', '#F87171'
  ),
});

function createThemePreset_(id, label, primary, secondary, accent, background, surface,
  text, mutedText, muted, border, success, warning, danger) {
  return Object.freeze({
    id: id,
    label: label,
    colors: Object.freeze({
      primary: primary,
      secondary: secondary,
      accent: accent,
      background: background,
      surface: surface,
      text: text,
      mutedText: mutedText,
      muted: muted,
      border: border,
      success: success,
      warning: warning,
      danger: danger,
      onPrimary: '#FFFFFF',
      onSecondary: '#FFFFFF',
      onAccent: '#FFFFFF',
    }),
  });
}

function getActiveTheme_(spreadsheet, configValues) {
  const values = configValues || getStoredConfigMap_(spreadsheet);
  const requestedPreset = values[CP.CONFIG_KEYS.THEME_PRESET];
  const preset = CP_THEME_PRESETS[requestedPreset] || CP_THEME_PRESETS[CP_DEFAULT_THEME_PRESET];
  const colors = Object.assign({}, preset.colors);

  [
    [CP.CONFIG_KEYS.THEME_PRIMARY, 'primary'],
    [CP.CONFIG_KEYS.THEME_SECONDARY, 'secondary'],
    [CP.CONFIG_KEYS.THEME_ACCENT, 'accent'],
  ].forEach(function(mapping) {
    const color = normalizeThemeColor_(values[mapping[0]]);
    if (color) {
      colors[mapping[1]] = color;
    }
  });

  return {
    id: preset.id,
    label: preset.label,
    isDark: preset.id.indexOf('oscuro-') === 0,
    colors: colors,
  };
}

function getThemeConfigForUi_(spreadsheet, configValues) {
  const theme = getActiveTheme_(spreadsheet, configValues);
  return {
    activePreset: theme.id,
    primary: theme.colors.primary,
    secondary: theme.colors.secondary,
    accent: theme.colors.accent,
    presets: Object.keys(CP_THEME_PRESETS).map(function(presetId) {
      const preset = CP_THEME_PRESETS[presetId];
      return {
        id: preset.id,
        label: preset.label,
        isDark: preset.id.indexOf('oscuro-') === 0,
        colors: Object.assign({}, preset.colors),
      };
    }),
  };
}

function validateThemeConfig_(values) {
  const presetId = values[CP.CONFIG_KEYS.THEME_PRESET];
  if (!CP_THEME_PRESETS[presetId]) {
    throw new Error('El tema visual seleccionado no existe.');
  }

  [
    CP.CONFIG_KEYS.THEME_PRIMARY,
    CP.CONFIG_KEYS.THEME_SECONDARY,
    CP.CONFIG_KEYS.THEME_ACCENT,
  ].forEach(function(key) {
    if (!normalizeThemeColor_(values[key])) {
      throw new Error('Los colores del tema deben tener el formato hexadecimal #RRGGBB.');
    }
  });
}

function normalizeThemeColor_(value) {
  const color = value === null || value === undefined ? '' : String(value).trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : '';
}

function getStoredConfigMap_(spreadsheet) {
  const configSheet = spreadsheet && spreadsheet.getSheetByName(CP.SHEETS.CONFIG);
  return configSheet ? getKeyValueMap_(configSheet, 1, 2) : {};
}

function createUiThemeCss_(theme) {
  const colors = theme.colors;
  return ':root{' +
    'color-scheme:' + (theme.isDark ? 'dark' : 'light') + ';' +
    '--primary:' + colors.primary + ';' +
    '--secondary:' + colors.secondary + ';' +
    '--accent:' + colors.accent + ';' +
    '--background:' + colors.background + ';' +
    '--surface:' + colors.surface + ';' +
    '--text:' + colors.text + ';' +
    '--muted-text:' + colors.mutedText + ';' +
    '--muted:' + colors.muted + ';' +
    '--border:' + colors.border + ';' +
    '--success:' + colors.success + ';' +
    '--warning:' + colors.warning + ';' +
    '--danger:' + colors.danger + ';' +
    '--on-primary:' + colors.onPrimary + ';' +
    '}';
}
