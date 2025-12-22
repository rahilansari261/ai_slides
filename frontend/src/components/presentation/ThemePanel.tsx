'use client';

import { motion } from 'framer-motion';
import { X, Palette, Type } from 'lucide-react';

interface Theme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

interface ThemePanelProps {
  theme: Theme;
  onChange: (updates: Partial<Theme>) => void;
  onClose: () => void;
}

const PRESET_THEMES = [
  {
    name: 'Cosmic Purple',
    primaryColor: '#7c3aed',
    secondaryColor: '#06b6d4',
    backgroundColor: '#0f172a',
    textColor: '#f8fafc',
  },
  {
    name: 'Ocean Blue',
    primaryColor: '#0ea5e9',
    secondaryColor: '#22d3ee',
    backgroundColor: '#0c1222',
    textColor: '#f0f9ff',
  },
  {
    name: 'Forest Green',
    primaryColor: '#22c55e',
    secondaryColor: '#86efac',
    backgroundColor: '#052e16',
    textColor: '#f0fdf4',
  },
  {
    name: 'Sunset Orange',
    primaryColor: '#f97316',
    secondaryColor: '#fbbf24',
    backgroundColor: '#1c1917',
    textColor: '#fef3c7',
  },
  {
    name: 'Rose Pink',
    primaryColor: '#ec4899',
    secondaryColor: '#f472b6',
    backgroundColor: '#1f1017',
    textColor: '#fdf2f8',
  },
  {
    name: 'Clean White',
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    backgroundColor: '#ffffff',
    textColor: '#1e293b',
  },
  {
    name: 'Slate Gray',
    primaryColor: '#3b82f6',
    secondaryColor: '#60a5fa',
    backgroundColor: '#f8fafc',
    textColor: '#0f172a',
  },
  {
    name: 'Midnight',
    primaryColor: '#a855f7',
    secondaryColor: '#c084fc',
    backgroundColor: '#030712',
    textColor: '#f9fafb',
  },
];

const FONT_OPTIONS = [
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Outfit',
];

export function ThemePanel({ theme, onChange, onClose }: ThemePanelProps) {
  const applyPreset = (preset: typeof PRESET_THEMES[0]) => {
    onChange({
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      backgroundColor: preset.backgroundColor,
      textColor: preset.textColor,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          Theme Settings
        </h3>
        <button
          onClick={onClose}
          className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Preset Themes */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-muted-foreground">Presets</label>
        <div className="grid grid-cols-2 gap-2">
          {PRESET_THEMES.map((preset) => (
            <motion.button
              key={preset.name}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => applyPreset(preset)}
              className="p-3 rounded-xl border border-border hover:border-primary/50 transition-colors text-left"
              style={{ backgroundColor: preset.backgroundColor }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: preset.primaryColor }}
                />
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: preset.secondaryColor }}
                />
              </div>
              <span
                className="text-xs font-medium"
                style={{ color: preset.textColor }}
              >
                {preset.name}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Custom Colors */}
      <div className="space-y-4">
        <label className="text-sm font-medium text-muted-foreground">Custom Colors</label>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Primary</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.primaryColor}
                onChange={(e) => onChange({ primaryColor: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border-0"
              />
              <input
                type="text"
                value={theme.primaryColor}
                onChange={(e) => onChange({ primaryColor: e.target.value })}
                className="w-24 px-2 py-1.5 bg-muted border border-border rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Secondary</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.secondaryColor}
                onChange={(e) => onChange({ secondaryColor: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border-0"
              />
              <input
                type="text"
                value={theme.secondaryColor}
                onChange={(e) => onChange({ secondaryColor: e.target.value })}
                className="w-24 px-2 py-1.5 bg-muted border border-border rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Background</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.backgroundColor}
                onChange={(e) => onChange({ backgroundColor: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border-0"
              />
              <input
                type="text"
                value={theme.backgroundColor}
                onChange={(e) => onChange({ backgroundColor: e.target.value })}
                className="w-24 px-2 py-1.5 bg-muted border border-border rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Text</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.textColor}
                onChange={(e) => onChange({ textColor: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border-0"
              />
              <input
                type="text"
                value={theme.textColor}
                onChange={(e) => onChange({ textColor: e.target.value })}
                className="w-24 px-2 py-1.5 bg-muted border border-border rounded-lg text-xs font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Font Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Type className="w-4 h-4" />
          Font Family
        </label>
        <select
          value={theme.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          style={{ fontFamily: theme.fontFamily }}
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font} value={font} style={{ fontFamily: font }}>
              {font}
            </option>
          ))}
        </select>
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-muted-foreground">Preview</label>
        <div
          className="p-6 rounded-xl"
          style={{ backgroundColor: theme.backgroundColor }}
        >
          <h4
            className="font-bold text-lg mb-2"
            style={{ color: theme.primaryColor, fontFamily: theme.fontFamily }}
          >
            Preview Title
          </h4>
          <p
            className="text-sm mb-3"
            style={{ color: theme.textColor, fontFamily: theme.fontFamily }}
          >
            This is how your slide text will look.
          </p>
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium"
              style={{ color: theme.secondaryColor }}
            >
              Secondary accent
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

