const CP_DEFAULT_THEME_PRESET = 'oceano';

const CP_THEME_PRESETS = Object.freeze({
  oceano: createThemePreset_('oceano', 'Océano', '#004E64', '#006E8A', '#167D70'),
  'turquesa-naranja': createThemePreset_(
    'turquesa-naranja', 'Turquesa naranja', '#0A656A', '#087987', '#B85D02'
  ),
  'verde-natural': createThemePreset_(
    'verde-natural', 'Verde natural', '#507255', '#3F773F', '#C5E063'
  ),
  'coral-menta': createThemePreset_(
    'coral-menta', 'Coral menta', '#B94F46', '#377771', '#4CE0B3'
  ),
  'burdeos-lavanda': createThemePreset_(
    'burdeos-lavanda', 'Burdeos lavanda', '#A30B37', '#734649', '#BBB6DF'
  ),
  'azul-clasico': createThemePreset_(
    'azul-clasico', 'Azul clásico', '#1D4ED8', '#075985', '#0F766E'
  ),
});

function createThemePreset_(id, label, primary, secondary, accent) {
  return Object.freeze({
    id: id,
    label: label,
    colors: Object.freeze(createLightThemeColors_(primary, secondary, accent)),
  });
}

function createLightThemeColors_(primary, secondary, accent) {
  return {
    primary: primary,
    secondary: secondary,
    accent: accent,
    background: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#172033',
    mutedText: '#64748B',
    muted: '#E8EEF6',
    border: '#CBD5E1',
    success: '#13795B',
    warning: '#B54708',
    danger: '#B42318',
    onPrimary: getAccessibleTextColor_(primary),
    onSecondary: getAccessibleTextColor_(secondary),
    onAccent: getAccessibleTextColor_(accent),
  };
}

function getActiveTheme_(spreadsheet, configValues) {
  const values = configValues || getStoredConfigMap_(spreadsheet);
  const requestedPreset = normalizeThemePresetId_(values[CP.CONFIG_KEYS.THEME_PRESET]);
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

  colors.onPrimary = getAccessibleTextColor_(colors.primary);
  colors.onSecondary = getAccessibleTextColor_(colors.secondary);
  colors.onAccent = getAccessibleTextColor_(colors.accent);

  return {
    id: preset.id,
    label: preset.label,
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
        colors: Object.assign({}, preset.colors),
      };
    }),
  };
}

function validateThemeConfig_(values) {
  const presetId = normalizeThemePresetId_(values[CP.CONFIG_KEYS.THEME_PRESET]);
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

function normalizeThemePresetId_(value) {
  const presetId = value === null || value === undefined ? '' : String(value).trim();
  const legacyPresets = {
    'claro-azul': 'azul-clasico',
    'oscuro-azul': 'azul-clasico',
    'claro-verde': 'verde-natural',
    'oscuro-verde': 'verde-natural',
  };
  const migratedPresetId = legacyPresets[presetId] || presetId;
  return CP_THEME_PRESETS[migratedPresetId] ? migratedPresetId : CP_DEFAULT_THEME_PRESET;
}

function normalizeThemeColor_(value) {
  const color = value === null || value === undefined ? '' : String(value).trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : '';
}

function getAccessibleTextColor_(backgroundColor) {
  const white = '#FFFFFF';
  const dark = '#172033';
  return getContrastRatio_(backgroundColor, white) >= getContrastRatio_(backgroundColor, dark)
    ? white
    : dark;
}

function getContrastRatio_(firstColor, secondColor) {
  const firstLuminance = getRelativeLuminance_(firstColor);
  const secondLuminance = getRelativeLuminance_(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function getRelativeLuminance_(color) {
  const channels = [1, 3, 5].map(function(start) {
    const value = parseInt(color.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function getStoredConfigMap_(spreadsheet) {
  const configSheet = spreadsheet && spreadsheet.getSheetByName(CP.SHEETS.CONFIG);
  return configSheet ? getKeyValueMap_(configSheet, 1, 2) : {};
}

function createUiThemeCss_(theme) {
  const colors = theme.colors;
  return ':root{' +
    'color-scheme:light;' +
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
