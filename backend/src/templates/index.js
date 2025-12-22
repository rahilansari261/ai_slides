// Pre-built presentation templates
// Each template defines colors, fonts, and decoration styles

export const TEMPLATES = {
  // Modern Dark - Default
  modern_dark: {
    id: 'modern_dark',
    name: 'Modern Dark',
    description: 'Sleek dark theme with purple accents',
    preview: '/templates/modern-dark.png',
    theme: {
      primaryColor: '#8b5cf6',
      secondaryColor: '#a78bfa',
      backgroundColor: '#0f172a',
      textColor: '#f8fafc',
      fontFamily: 'Arial'
    },
    decorationStyle: 'geometric'
  },

  // Corporate Blue
  corporate_blue: {
    id: 'corporate_blue',
    name: 'Corporate Blue',
    description: 'Professional blue theme for business',
    preview: '/templates/corporate-blue.png',
    theme: {
      primaryColor: '#2563eb',
      secondaryColor: '#3b82f6',
      backgroundColor: '#0f172a',
      textColor: '#f1f5f9',
      fontFamily: 'Arial'
    },
    decorationStyle: 'corporate'
  },

  // Sunset Orange
  sunset_orange: {
    id: 'sunset_orange',
    name: 'Sunset Gradient',
    description: 'Warm orange and pink tones',
    preview: '/templates/sunset-orange.png',
    theme: {
      primaryColor: '#f97316',
      secondaryColor: '#fb923c',
      backgroundColor: '#1c1917',
      textColor: '#fafaf9',
      fontFamily: 'Arial'
    },
    decorationStyle: 'waves'
  },

  // Emerald Green
  emerald_green: {
    id: 'emerald_green',
    name: 'Emerald Nature',
    description: 'Fresh green theme for eco topics',
    preview: '/templates/emerald-green.png',
    theme: {
      primaryColor: '#10b981',
      secondaryColor: '#34d399',
      backgroundColor: '#0c1a14',
      textColor: '#ecfdf5',
      fontFamily: 'Arial'
    },
    decorationStyle: 'organic'
  },

  // Rose Pink
  rose_pink: {
    id: 'rose_pink',
    name: 'Rose Elegance',
    description: 'Elegant pink theme for creative content',
    preview: '/templates/rose-pink.png',
    theme: {
      primaryColor: '#ec4899',
      secondaryColor: '#f472b6',
      backgroundColor: '#1a0a14',
      textColor: '#fdf2f8',
      fontFamily: 'Arial'
    },
    decorationStyle: 'elegant'
  },

  // Ocean Teal
  ocean_teal: {
    id: 'ocean_teal',
    name: 'Ocean Breeze',
    description: 'Calming teal for educational content',
    preview: '/templates/ocean-teal.png',
    theme: {
      primaryColor: '#14b8a6',
      secondaryColor: '#2dd4bf',
      backgroundColor: '#0a1a1a',
      textColor: '#f0fdfa',
      fontFamily: 'Arial'
    },
    decorationStyle: 'flowing'
  },

  // Golden Yellow
  golden_yellow: {
    id: 'golden_yellow',
    name: 'Golden Hour',
    description: 'Bold yellow for impactful presentations',
    preview: '/templates/golden-yellow.png',
    theme: {
      primaryColor: '#eab308',
      secondaryColor: '#facc15',
      backgroundColor: '#1a1a0a',
      textColor: '#fefce8',
      fontFamily: 'Arial'
    },
    decorationStyle: 'bold'
  },

  // Crimson Red
  crimson_red: {
    id: 'crimson_red',
    name: 'Crimson Power',
    description: 'Powerful red for sales pitches',
    preview: '/templates/crimson-red.png',
    theme: {
      primaryColor: '#dc2626',
      secondaryColor: '#ef4444',
      backgroundColor: '#1a0a0a',
      textColor: '#fef2f2',
      fontFamily: 'Arial'
    },
    decorationStyle: 'dynamic'
  },

  // Minimal Light
  minimal_light: {
    id: 'minimal_light',
    name: 'Minimal Light',
    description: 'Clean white theme for readability',
    preview: '/templates/minimal-light.png',
    theme: {
      primaryColor: '#1e293b',
      secondaryColor: '#475569',
      backgroundColor: '#ffffff',
      textColor: '#1e293b',
      fontFamily: 'Arial'
    },
    decorationStyle: 'minimal'
  },

  // Cyber Neon
  cyber_neon: {
    id: 'cyber_neon',
    name: 'Cyber Neon',
    description: 'Futuristic neon for tech topics',
    preview: '/templates/cyber-neon.png',
    theme: {
      primaryColor: '#06b6d4',
      secondaryColor: '#22d3ee',
      backgroundColor: '#020617',
      textColor: '#e0f2fe',
      fontFamily: 'Arial'
    },
    decorationStyle: 'cyber'
  },

  // Royal Purple
  royal_purple: {
    id: 'royal_purple',
    name: 'Royal Purple',
    description: 'Luxurious purple for premium content',
    preview: '/templates/royal-purple.png',
    theme: {
      primaryColor: '#7c3aed',
      secondaryColor: '#a855f7',
      backgroundColor: '#0f0a1a',
      textColor: '#f5f3ff',
      fontFamily: 'Arial'
    },
    decorationStyle: 'royal'
  },

  // Slate Professional
  slate_professional: {
    id: 'slate_professional',
    name: 'Slate Pro',
    description: 'Neutral slate for any occasion',
    preview: '/templates/slate-pro.png',
    theme: {
      primaryColor: '#64748b',
      secondaryColor: '#94a3b8',
      backgroundColor: '#0f172a',
      textColor: '#f1f5f9',
      fontFamily: 'Arial'
    },
    decorationStyle: 'professional'
  }
};

export const getTemplate = (templateId) => {
  return TEMPLATES[templateId] || TEMPLATES.modern_dark;
};

export const getAllTemplates = () => {
  return Object.values(TEMPLATES);
};

