const CP_DEFAULT_THEME_PRESET = 'verde-profesional';

const CP_THEME_PRESETS = Object.freeze({
  'verde-profesional': createThemePreset_('verde-profesional', 'Verde profesional', '#2F6B4F', '#355C6D', '#D07A32'),
  'bosque-sereno': createThemePreset_('bosque-sereno', 'Bosque sereno', '#3F6B45', '#68705C', '#C59A45'),
  atlantico: createThemePreset_('atlantico', 'Atlántico', '#1F6E8C', '#355070', '#A65B7C'),
  'petroleo-coral': createThemePreset_('petroleo-coral', 'Petróleo coral', '#0F6674', '#3F556B', '#A85D46'),
  'indigo-ambar': createThemePreset_('indigo-ambar', 'Índigo ámbar', '#4454A6', '#56657A', '#C98732'),
  'burdeos-piedra': createThemePreset_('burdeos-piedra', 'Burdeos piedra', '#8A3D52', '#5F6878', '#D0A64A'),
  'terracota-salvia': createThemePreset_('terracota-salvia', 'Terracota salvia', '#A6553D', '#496D6A', '#3A8276'),
  'ciruela-arena': createThemePreset_('ciruela-arena', 'Ciruela arena', '#6E477B', '#596579', '#C57E42'),
  'azul-profesional': createThemePreset_('azul-profesional', 'Azul profesional', '#2D5F9A', '#4D647A', '#2F7E7A'),
  'grafito-esmeralda': createThemePreset_('grafito-esmeralda', 'Grafito esmeralda', '#475569', '#2F7464', '#B9832F'),
});

const CP_LEGACY_THEME_PRESETS = Object.freeze({
  oceano: { id: 'atlantico', colors: ['#004E64', '#006E8A', '#167D70'] },
  'turquesa-naranja': { id: 'petroleo-coral', colors: ['#0A656A', '#087987', '#B85D02'] },
  'verde-natural': { id: 'verde-profesional', colors: ['#507255', '#3F773F', '#C5E063'] },
  'coral-menta': { id: 'terracota-salvia', colors: ['#B94F46', '#377771', '#4CE0B3'] },
  'burdeos-lavanda': { id: 'burdeos-piedra', colors: ['#A30B37', '#734649', '#BBB6DF'] },
  'azul-clasico': { id: 'azul-profesional', colors: ['#1D4ED8', '#075985', '#0F766E'] },
  'claro-azul': { id: 'azul-profesional' },
  'oscuro-azul': { id: 'azul-profesional' },
  'claro-verde': { id: 'verde-profesional' },
  'oscuro-verde': { id: 'verde-profesional' },
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
    mixedDay: '#F59E0B',
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
  const legacyPreset = CP_LEGACY_THEME_PRESETS[String(values[CP.CONFIG_KEYS.THEME_PRESET] || '').trim()];
  const storedColors = [CP.CONFIG_KEYS.THEME_PRIMARY, CP.CONFIG_KEYS.THEME_SECONDARY,
    CP.CONFIG_KEYS.THEME_ACCENT].map(function(key) { return normalizeThemeColor_(values[key]); });
  const isLegacyDefault = legacyPreset && legacyPreset.colors && storedColors.every(function(color, index) {
    return color === legacyPreset.colors[index];
  });

  [
    [CP.CONFIG_KEYS.THEME_PRIMARY, 'primary'],
    [CP.CONFIG_KEYS.THEME_SECONDARY, 'secondary'],
    [CP.CONFIG_KEYS.THEME_ACCENT, 'accent'],
  ].forEach(function(mapping) {
    const color = normalizeThemeColor_(values[mapping[0]]);
    if (color && !isLegacyDefault) {
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

function applyThemeToManagedWorkbook_(spreadsheet, previousTheme, nextTheme) {
  const oldColors = previousTheme.colors;
  const newColors = nextTheme.colors;
  const backgroundMap = {};
  ['primary', 'secondary', 'accent'].forEach(function(key) {
    if (oldColors[key].toUpperCase() !== newColors[key].toUpperCase()) {
      backgroundMap[oldColors[key].toUpperCase()] = newColors[key];
    }
  });
  const registeredIds = readModuleConfigRegistry_(spreadsheet).reduce(function(ids, record) {
    [record.sheetId, record.trackingSheetId, record.evaluationSheetId].forEach(function(id) {
      if (id) ids[id] = true;
    });
    return ids;
  }, {});
  const fixedNames = [CP.SHEETS.COVER, CP.SHEETS.CALENDAR,
    CP.SHEETS.SCHEDULE, CP.SHEETS.STUDENTS];
  spreadsheet.getSheets().forEach(function(sheet) {
    if (sheet.isSheetHidden()) return;
    const name = sheet.getName();
    const isOldTracking = /^5 Seg\b.*\bOLD\b/.test(name) &&
      isRegisteredModuleTrackingSheet_(sheet);
    if (fixedNames.indexOf(name) === -1 && !registeredIds[sheet.getSheetId()] &&
        !isOldTracking) return;
    if (name === CP.SHEETS.COVER) {
      applyCoverTheme_(sheet, nextTheme);
      renderCoverIndex_(sheet);
      return;
    }
    const rows = sheet.getLastRow();
    const columns = sheet.getLastColumn();
    if (!rows || !columns) return;
    const range = sheet.getRange(1, 1, rows, columns);
    const backgrounds = range.getBackgrounds();
    const fontColors = range.getFontColors();
    let changed = false;
    backgrounds.forEach(function(row, rowIndex) {
      row.forEach(function(background, columnIndex) {
        const normalized = String(background).toUpperCase();
        if (!backgroundMap[normalized]) return;
        const role = ['primary', 'secondary', 'accent'].find(function(key) {
          return oldColors[key].toUpperCase() === normalized;
        });
        row[columnIndex] = backgroundMap[normalized];
        const oldText = oldColors['on' + role.charAt(0).toUpperCase() + role.slice(1)];
        const newText = newColors['on' + role.charAt(0).toUpperCase() + role.slice(1)];
        if (String(fontColors[rowIndex][columnIndex]).toUpperCase() === oldText.toUpperCase()) {
          fontColors[rowIndex][columnIndex] = newText;
        }
        changed = true;
      });
    });
    if (changed) range.setBackgrounds(backgrounds).setFontColors(fontColors);
    if (name === CP.SHEETS.SCHEDULE) {
      const slots = getScheduleTimeSlots_();
      if (slots.length) applyScheduleCurrentTimeRules_(sheet,
        { theme: nextTheme, slots: slots });
    }
  });
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
  const legacyPreset = CP_LEGACY_THEME_PRESETS[presetId];
  const migratedPresetId = legacyPreset ? legacyPreset.id : presetId;
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
    '--mixed-day:' + colors.mixedDay + ';' +
    '--on-primary:' + colors.onPrimary + ';' +
    '}';
}
