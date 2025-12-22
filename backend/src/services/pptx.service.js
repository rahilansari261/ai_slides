import PptxGenJS from 'pptxgenjs';
import path from 'path';

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? hex.replace('#', '') : '000000';
};

// Helper to create lighter/darker shades
const adjustColor = (hex, percent) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return ((R << 16) | (G << 8) | B).toString(16).padStart(6, '0');
};

// Decoration styles based on template
const DECORATION_STYLES = {
  geometric: {
    title: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      slide.addShape('rtTriangle', { x: 9.5, y: 0, w: 3.83, h: 7.5, fill: { color: primary, transparency: 85 } });
      slide.addShape('ellipse', { x: 10.5, y: 5, w: 3.5, h: 3.5, fill: { color: secondary, transparency: 70 } });
      slide.addShape('rect', { x: 0, y: 6.8, w: 5, h: 0.7, fill: { color: primary } });
    },
    content: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      slide.addShape('rect', { x: 0, y: 0, w: 0.15, h: 7.5, fill: { color: primary } });
      slide.addShape('rtTriangle', { x: 11.5, y: 0, w: 1.83, h: 1.5, fill: { color: secondary, transparency: 80 }, rotate: 90 });
      slide.addShape('rect', { x: 0.5, y: 7, w: 4, h: 0.08, fill: { color: primary, transparency: 50 } });
    },
    quote: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      slide.addShape('ellipse', { x: -2, y: -1, w: 8, h: 8, fill: { color: primary, transparency: 90 } });
      slide.addShape('ellipse', { x: 11, y: 5, w: 3, h: 3, fill: { color: secondary, transparency: 85 } });
    },
    stats: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      slide.addShape('ellipse', { x: -1, y: 5.5, w: 6, h: 3, fill: { color: primary, transparency: 85 } });
      slide.addShape('ellipse', { x: 8, y: 5.8, w: 7, h: 2.5, fill: { color: secondary, transparency: 85 } });
    },
    section: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      slide.addShape('rtTriangle', { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: primary, transparency: 92 } });
      slide.addShape('ellipse', { x: 10, y: 0.5, w: 2.5, h: 2.5, fill: { color: secondary, transparency: 70 } });
    }
  },

  corporate: {
    title: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      // Clean horizontal lines
      slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.15, fill: { color: primary } });
      slide.addShape('rect', { x: 0, y: 7.35, w: 13.33, h: 0.15, fill: { color: primary } });
      slide.addShape('rect', { x: 0.5, y: 6.5, w: 4, h: 0.08, fill: { color: secondary } });
      // Corner accent
      slide.addShape('rect', { x: 12, y: 0.5, w: 0.8, h: 3, fill: { color: secondary, transparency: 60 } });
    },
    content: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: primary } });
      slide.addShape('rect', { x: 0, y: 0.08, w: 0.3, h: 1.5, fill: { color: primary } });
    },
    quote: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 1, y: 2, w: 0.08, h: 3.5, fill: { color: primary } });
      slide.addShape('rect', { x: 12, y: 2, w: 0.08, h: 3.5, fill: { color: primary } });
    },
    stats: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0, y: 6.5, w: 13.33, h: 0.5, fill: { color: primary, transparency: 80 } });
    },
    section: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0, y: 3.2, w: 13.33, h: 0.1, fill: { color: primary } });
      slide.addShape('rect', { x: 0, y: 4.2, w: 13.33, h: 0.1, fill: { color: primary } });
    }
  },

  waves: {
    title: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      // Wave-like curves using ellipses
      slide.addShape('ellipse', { x: -3, y: 5, w: 10, h: 4, fill: { color: primary, transparency: 70 } });
      slide.addShape('ellipse', { x: 4, y: 5.5, w: 12, h: 3.5, fill: { color: secondary, transparency: 80 } });
      slide.addShape('ellipse', { x: 10, y: -2, w: 5, h: 5, fill: { color: primary, transparency: 85 } });
    },
    content: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      slide.addShape('ellipse', { x: -4, y: 6, w: 8, h: 3, fill: { color: primary, transparency: 85 } });
      slide.addShape('ellipse', { x: 10, y: -1, w: 4, h: 3, fill: { color: secondary, transparency: 90 } });
    },
    quote: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('ellipse', { x: -2, y: 4, w: 8, h: 6, fill: { color: primary, transparency: 90 } });
      slide.addShape('ellipse', { x: 9, y: 0, w: 6, h: 5, fill: { color: primary, transparency: 92 } });
    },
    stats: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      slide.addShape('ellipse', { x: -2, y: 5, w: 8, h: 4, fill: { color: primary, transparency: 85 } });
      slide.addShape('ellipse', { x: 7, y: 5.5, w: 9, h: 3, fill: { color: secondary, transparency: 85 } });
    },
    section: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('ellipse', { x: -4, y: -2, w: 10, h: 8, fill: { color: primary, transparency: 90 } });
      slide.addShape('ellipse', { x: 8, y: 4, w: 8, h: 6, fill: { color: primary, transparency: 92 } });
    }
  },

  organic: {
    title: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      // Organic blob-like shapes
      slide.addShape('ellipse', { x: 9, y: -1, w: 5, h: 5, fill: { color: primary, transparency: 75 } });
      slide.addShape('ellipse', { x: 10.5, y: 2, w: 4, h: 4, fill: { color: secondary, transparency: 80 } });
      slide.addShape('ellipse', { x: -1, y: 5, w: 4, h: 4, fill: { color: primary, transparency: 85 } });
    },
    content: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('ellipse', { x: -2, y: -1, w: 3, h: 3, fill: { color: primary, transparency: 85 } });
      slide.addShape('ellipse', { x: 12, y: 6, w: 2.5, h: 2.5, fill: { color: primary, transparency: 80 } });
    },
    quote: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('ellipse', { x: -1, y: 1, w: 6, h: 5, fill: { color: primary, transparency: 88 } });
      slide.addShape('ellipse', { x: 10, y: 4, w: 4, h: 4, fill: { color: primary, transparency: 85 } });
    },
    stats: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('ellipse', { x: -1, y: 5.5, w: 5, h: 3.5, fill: { color: primary, transparency: 80 } });
      slide.addShape('ellipse', { x: 10, y: 5, w: 4.5, h: 4, fill: { color: primary, transparency: 85 } });
    },
    section: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      slide.addShape('ellipse', { x: 4, y: 1, w: 5, h: 5, fill: { color: secondary, transparency: 75 } });
      slide.addShape('ellipse', { x: -2, y: 3, w: 4, h: 4, fill: { color: primary, transparency: 85 } });
      slide.addShape('ellipse', { x: 11, y: 4, w: 3.5, h: 3.5, fill: { color: primary, transparency: 80 } });
    }
  },

  elegant: {
    title: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      // Elegant thin lines and small accents
      slide.addShape('rect', { x: 0.5, y: 6, w: 5, h: 0.03, fill: { color: primary } });
      slide.addShape('rect', { x: 0.5, y: 6.1, w: 3, h: 0.03, fill: { color: secondary } });
      slide.addShape('ellipse', { x: 11.5, y: 0.5, w: 1.3, h: 1.3, fill: { color: primary, transparency: 70 } });
      slide.addShape('ellipse', { x: 12, y: 1.3, w: 0.8, h: 0.8, fill: { color: secondary, transparency: 60 } });
    },
    content: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0.3, y: 0.3, w: 0.05, h: 1.5, fill: { color: primary } });
      slide.addShape('rect', { x: 0.3, y: 0.3, w: 2, h: 0.05, fill: { color: primary } });
    },
    quote: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 2, y: 2.5, w: 9, h: 0.02, fill: { color: primary, transparency: 50 } });
      slide.addShape('rect', { x: 2, y: 5, w: 9, h: 0.02, fill: { color: primary, transparency: 50 } });
    },
    stats: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0.5, y: 1.5, w: 12, h: 0.02, fill: { color: primary, transparency: 60 } });
    },
    section: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 4, y: 3.3, w: 5, h: 0.03, fill: { color: primary } });
      slide.addShape('rect', { x: 5, y: 4.2, w: 3, h: 0.03, fill: { color: primary } });
    }
  },

  flowing: {
    title: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      slide.addShape('ellipse', { x: -3, y: 4, w: 9, h: 6, fill: { color: primary, transparency: 80 } });
      slide.addShape('ellipse', { x: 7, y: 5, w: 8, h: 5, fill: { color: secondary, transparency: 85 } });
      slide.addShape('ellipse', { x: 10, y: -1, w: 4, h: 3, fill: { color: primary, transparency: 90 } });
    },
    content: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('ellipse', { x: -3, y: 6, w: 6, h: 3, fill: { color: primary, transparency: 85 } });
      slide.addShape('rect', { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: primary } });
    },
    quote: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('ellipse', { x: -2, y: 2, w: 7, h: 5, fill: { color: primary, transparency: 90 } });
    },
    stats: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('ellipse', { x: -2, y: 5, w: 8, h: 4, fill: { color: primary, transparency: 85 } });
      slide.addShape('ellipse', { x: 8, y: 5.5, w: 7, h: 3.5, fill: { color: primary, transparency: 88 } });
    },
    section: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('ellipse', { x: 3, y: 2, w: 7, h: 6, fill: { color: primary, transparency: 88 } });
    }
  },

  bold: {
    title: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      // Bold geometric blocks
      slide.addShape('rect', { x: 10, y: 0, w: 3.33, h: 7.5, fill: { color: primary, transparency: 70 } });
      slide.addShape('rect', { x: 0, y: 6, w: 6, h: 1.5, fill: { color: secondary, transparency: 75 } });
    },
    content: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0, y: 0, w: 0.4, h: 7.5, fill: { color: primary } });
      slide.addShape('rect', { x: 0.4, y: 0, w: 0.1, h: 7.5, fill: { color: primary, transparency: 50 } });
    },
    quote: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0, y: 2, w: 0.5, h: 3.5, fill: { color: primary } });
      slide.addShape('rect', { x: 12.83, y: 2, w: 0.5, h: 3.5, fill: { color: primary } });
    },
    stats: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0, y: 6, w: 13.33, h: 1.5, fill: { color: primary, transparency: 75 } });
    },
    section: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0, y: 0, w: 5, h: 7.5, fill: { color: primary, transparency: 85 } });
    }
  },

  dynamic: {
    title: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      // Dynamic diagonal slashes
      slide.addShape('rtTriangle', { x: 8, y: 0, w: 5.33, h: 7.5, fill: { color: primary, transparency: 75 } });
      slide.addShape('rtTriangle', { x: 10, y: 0, w: 3.33, h: 5, fill: { color: secondary, transparency: 70 } });
      slide.addShape('rect', { x: 0, y: 6.5, w: 4, h: 1, fill: { color: primary } });
    },
    content: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rtTriangle', { x: 11, y: 0, w: 2.33, h: 2, fill: { color: primary, transparency: 80 } });
      slide.addShape('rect', { x: 0, y: 0, w: 0.2, h: 7.5, fill: { color: primary } });
    },
    quote: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rtTriangle', { x: -1, y: 0, w: 4, h: 4, fill: { color: primary, transparency: 85 } });
      slide.addShape('rtTriangle', { x: 10.33, y: 3.5, w: 4, h: 4, fill: { color: primary, transparency: 85 }, rotate: 180 });
    },
    stats: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rtTriangle', { x: -1, y: 5, w: 5, h: 3, fill: { color: primary, transparency: 80 } });
      slide.addShape('rtTriangle', { x: 9.33, y: 5, w: 5, h: 3, fill: { color: primary, transparency: 80 }, rotate: 90 });
    },
    section: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rtTriangle', { x: 0, y: 0, w: 7, h: 7.5, fill: { color: primary, transparency: 88 } });
      slide.addShape('rtTriangle', { x: 6.33, y: 0, w: 7, h: 7.5, fill: { color: primary, transparency: 92 }, rotate: 180 });
    }
  },

  minimal: {
    title: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0.5, y: 4.5, w: 3, h: 0.06, fill: { color: primary } });
    },
    content: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0.3, y: 0.35, w: 0.08, h: 1, fill: { color: primary } });
    },
    quote: (slide, theme) => {
      // Minimal - almost no decoration
    },
    stats: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0.5, y: 6.5, w: 12.33, h: 0.03, fill: { color: primary, transparency: 50 } });
    },
    section: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 5.67, y: 5, w: 2, h: 0.06, fill: { color: primary } });
    }
  },

  cyber: {
    title: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      // Cyber grid lines
      for (let i = 0; i < 5; i++) {
        slide.addShape('rect', { x: 10 + i * 0.5, y: 0, w: 0.03, h: 7.5, fill: { color: primary, transparency: 80 + i * 3 } });
      }
      slide.addShape('rect', { x: 0, y: 6.5, w: 5, h: 0.5, fill: { color: primary } });
      slide.addShape('rect', { x: 0, y: 6.3, w: 3, h: 0.15, fill: { color: secondary } });
      // Corner bracket
      slide.addShape('rect', { x: 11.5, y: 0.3, w: 1.5, h: 0.08, fill: { color: primary } });
      slide.addShape('rect', { x: 12.92, y: 0.3, w: 0.08, h: 1.5, fill: { color: primary } });
    },
    content: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0, y: 0, w: 0.08, h: 7.5, fill: { color: primary } });
      slide.addShape('rect', { x: 0.15, y: 0, w: 0.03, h: 7.5, fill: { color: primary, transparency: 60 } });
      slide.addShape('rect', { x: 12, y: 0, w: 0.03, h: 2, fill: { color: primary, transparency: 70 } });
    },
    quote: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      // Corner brackets
      slide.addShape('rect', { x: 1, y: 2, w: 1, h: 0.05, fill: { color: primary } });
      slide.addShape('rect', { x: 1, y: 2, w: 0.05, h: 1, fill: { color: primary } });
      slide.addShape('rect', { x: 11.33, y: 5, w: 1, h: 0.05, fill: { color: primary } });
      slide.addShape('rect', { x: 12.28, y: 4, w: 0.05, h: 1, fill: { color: primary } });
    },
    stats: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      for (let i = 0; i < 4; i++) {
        slide.addShape('rect', { x: 0.5 + i * 3.2, y: 6.5, w: 2.8, h: 0.08, fill: { color: primary, transparency: 60 } });
      }
    },
    section: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 3, y: 3.5, w: 7, h: 0.05, fill: { color: primary } });
      slide.addShape('rect', { x: 4, y: 4, w: 5, h: 0.05, fill: { color: primary, transparency: 60 } });
    }
  },

  royal: {
    title: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      // Royal ornate corners
      slide.addShape('rect', { x: 0, y: 0, w: 2, h: 0.1, fill: { color: primary } });
      slide.addShape('rect', { x: 0, y: 0, w: 0.1, h: 2, fill: { color: primary } });
      slide.addShape('rect', { x: 11.33, y: 0, w: 2, h: 0.1, fill: { color: primary } });
      slide.addShape('rect', { x: 13.23, y: 0, w: 0.1, h: 2, fill: { color: primary } });
      slide.addShape('ellipse', { x: 10, y: 3, w: 4, h: 4, fill: { color: secondary, transparency: 80 } });
      slide.addShape('rect', { x: 0, y: 7.4, w: 5, h: 0.1, fill: { color: primary } });
    },
    content: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0.3, y: 0.3, w: 0.08, h: 1.2, fill: { color: primary } });
      slide.addShape('rect', { x: 0.3, y: 0.3, w: 1.2, h: 0.08, fill: { color: primary } });
      slide.addShape('ellipse', { x: 12, y: 6, w: 1.5, h: 1.5, fill: { color: primary, transparency: 75 } });
    },
    quote: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 2, y: 2.2, w: 9, h: 0.03, fill: { color: primary, transparency: 60 } });
      slide.addShape('rect', { x: 2, y: 5.3, w: 9, h: 0.03, fill: { color: primary, transparency: 60 } });
      slide.addShape('ellipse', { x: 5.67, y: 1.5, w: 2, h: 0.5, fill: { color: primary, transparency: 80 } });
    },
    stats: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0, y: 7, w: 13.33, h: 0.1, fill: { color: primary, transparency: 70 } });
      slide.addShape('rect', { x: 0, y: 6.8, w: 13.33, h: 0.03, fill: { color: primary, transparency: 50 } });
    },
    section: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      slide.addShape('ellipse', { x: 5.17, y: 1.5, w: 3, h: 3, fill: { color: secondary, transparency: 70 } });
      slide.addShape('rect', { x: 4, y: 5.2, w: 5, h: 0.05, fill: { color: primary } });
    }
  },

  professional: {
    title: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      const secondary = hexToRgb(theme.secondaryColor);
      slide.addShape('rect', { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: primary } });
      slide.addShape('rect', { x: 0.35, y: 6, w: 4, h: 0.06, fill: { color: secondary } });
      slide.addShape('rect', { x: 11, y: 0, w: 2.33, h: 0.15, fill: { color: primary, transparency: 70 } });
    },
    content: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0, y: 0, w: 0.15, h: 7.5, fill: { color: primary } });
      slide.addShape('rect', { x: 0, y: 7.35, w: 13.33, h: 0.08, fill: { color: primary, transparency: 60 } });
    },
    quote: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 1.5, y: 2.5, w: 0.06, h: 2.5, fill: { color: primary } });
    },
    stats: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0, y: 0, w: 0.15, h: 7.5, fill: { color: primary } });
    },
    section: (slide, theme) => {
      const primary = hexToRgb(theme.primaryColor);
      slide.addShape('rect', { x: 0, y: 3.5, w: 13.33, h: 0.08, fill: { color: primary } });
    }
  }
};

// Get decoration function for a style
const getDecoration = (style, slideType) => {
  const decorations = DECORATION_STYLES[style] || DECORATION_STYLES.geometric;
  return decorations[slideType] || decorations.content || (() => {});
};

// Add decorative elements to slides
const addDecorations = (slide, theme, slideType, decorationStyle) => {
  const decoration = getDecoration(decorationStyle, slideType);
  if (decoration) {
    decoration(slide, theme);
  }
};

// Add title bar decoration
const addTitleBar = (slide, theme, y = 0) => {
  slide.addShape('rect', {
    x: 0, y: y, w: 0.12, h: 1.2,
    fill: { color: hexToRgb(theme.primaryColor) }
  });
};

export const createPPTX = async (presentation, outputDir) => {
  const pptx = new PptxGenJS();
  
  pptx.author = 'AI Slides';
  pptx.title = presentation.topic || 'Presentation';
  pptx.subject = presentation.topic || 'AI Generated Presentation';
  
  pptx.defineLayout({ name: 'CUSTOM', width: 13.33, height: 7.5 });
  pptx.layout = 'CUSTOM';

  const theme = presentation.theme || {
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    backgroundColor: '#0f172a',
    textColor: '#f8fafc',
    fontFamily: 'Arial'
  };

  const decorationStyle = presentation.decorationStyle || 'geometric';

  for (const slideData of presentation.slides) {
    const slide = pptx.addSlide();
    
    slide.background = { color: hexToRgb(theme.backgroundColor) };

    switch (slideData.type) {
      case 'title':
        addDecorations(slide, theme, 'title', decorationStyle);
        createTitleSlide(slide, slideData, theme);
        break;
      case 'content':
        addDecorations(slide, theme, 'content', decorationStyle);
        createContentSlide(slide, slideData, theme);
        break;
      case 'two-column':
        addDecorations(slide, theme, 'content', decorationStyle);
        createTwoColumnSlide(slide, slideData, theme);
        break;
      case 'quote':
        addDecorations(slide, theme, 'quote', decorationStyle);
        createQuoteSlide(slide, slideData, theme);
        break;
      case 'stats':
        addDecorations(slide, theme, 'stats', decorationStyle);
        createStatsSlide(slide, slideData, theme);
        break;
      case 'section':
        addDecorations(slide, theme, 'section', decorationStyle);
        createSectionSlide(slide, slideData, theme);
        break;
      case 'conclusion':
        addDecorations(slide, theme, 'title', decorationStyle);
        createConclusionSlide(slide, slideData, theme);
        break;
      default:
        addDecorations(slide, theme, 'content', decorationStyle);
        createContentSlide(slide, slideData, theme);
    }

    if (slideData.speakerNotes) {
      slide.addNotes(slideData.speakerNotes);
    }
  }

  const sanitizedTopic = (presentation.topic || 'presentation')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50);
  const filename = `${sanitizedTopic}.pptx`;
  const outputPath = path.join(outputDir, filename);

  await pptx.writeFile({ fileName: outputPath });
  
  return outputPath;
};

const createTitleSlide = (slide, data, theme) => {
  slide.addText(data.title || 'Presentation', {
    x: 0.7, y: 2.6, w: 9, h: 1.5,
    fontSize: 52, bold: true,
    color: adjustColor(theme.primaryColor, -30),
    fontFace: theme.fontFamily
  });
  slide.addText(data.title || 'Presentation', {
    x: 0.6, y: 2.5, w: 9, h: 1.5,
    fontSize: 52, bold: true,
    color: hexToRgb(theme.primaryColor),
    fontFace: theme.fontFamily
  });

  slide.addShape('rect', {
    x: 0.6, y: 4.1, w: 2.5, h: 0.12,
    fill: { color: hexToRgb(theme.secondaryColor) }
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.6, y: 4.5, w: 8, h: 0.8,
      fontSize: 24,
      color: hexToRgb(theme.textColor),
      fontFace: theme.fontFamily
    });
  }
};

const createContentSlide = (slide, data, theme) => {
  addTitleBar(slide, theme, 0.35);
  slide.addText(data.title || '', {
    x: 0.4, y: 0.35, w: 12, h: 1,
    fontSize: 36, bold: true,
    color: hexToRgb(theme.primaryColor),
    fontFace: theme.fontFamily
  });

  if (data.bullets && data.bullets.length > 0) {
    const bulletPoints = data.bullets.map((bullet, i) => ({
      text: bullet,
      options: {
        bullet: { 
          type: 'number',
          style: 'arabicPeriod',
          color: hexToRgb(theme.secondaryColor)
        },
        color: hexToRgb(theme.textColor),
        fontSize: 22,
        fontFace: theme.fontFamily,
        paraSpaceBefore: 8,
        paraSpaceAfter: 8,
        indentLevel: 0
      }
    }));

    slide.addText(bulletPoints, {
      x: 0.6, y: 1.7, w: 11.5, h: 5,
      valign: 'top'
    });
  }
};

const createTwoColumnSlide = (slide, data, theme) => {
  addTitleBar(slide, theme, 0.35);
  slide.addText(data.title || '', {
    x: 0.4, y: 0.35, w: 12, h: 1,
    fontSize: 36, bold: true,
    color: hexToRgb(theme.primaryColor),
    fontFace: theme.fontFamily
  });

  slide.addShape('roundRect', {
    x: 0.4, y: 1.6, w: 6, h: 5.4,
    fill: { color: hexToRgb(theme.primaryColor), transparency: 92 },
    line: { color: hexToRgb(theme.primaryColor), width: 1, transparency: 70 }
  });

  if (data.leftColumn) {
    slide.addText(data.leftColumn.heading || '', {
      x: 0.6, y: 1.8, w: 5.6, h: 0.7,
      fontSize: 24, bold: true,
      color: hexToRgb(theme.secondaryColor),
      fontFace: theme.fontFamily
    });

    if (data.leftColumn.bullets) {
      const leftBullets = data.leftColumn.bullets.map(bullet => ({
        text: bullet,
        options: {
          bullet: { type: 'bullet', color: hexToRgb(theme.secondaryColor) },
          color: hexToRgb(theme.textColor),
          fontSize: 18,
          fontFace: theme.fontFamily,
          paraSpaceAfter: 10
        }
      }));
      slide.addText(leftBullets, {
        x: 0.6, y: 2.6, w: 5.6, h: 4,
        valign: 'top'
      });
    }
  }

  slide.addShape('roundRect', {
    x: 6.8, y: 1.6, w: 6, h: 5.4,
    fill: { color: hexToRgb(theme.secondaryColor), transparency: 92 },
    line: { color: hexToRgb(theme.secondaryColor), width: 1, transparency: 70 }
  });

  if (data.rightColumn) {
    slide.addText(data.rightColumn.heading || '', {
      x: 7, y: 1.8, w: 5.6, h: 0.7,
      fontSize: 24, bold: true,
      color: hexToRgb(theme.primaryColor),
      fontFace: theme.fontFamily
    });

    if (data.rightColumn.bullets) {
      const rightBullets = data.rightColumn.bullets.map(bullet => ({
        text: bullet,
        options: {
          bullet: { type: 'bullet', color: hexToRgb(theme.primaryColor) },
          color: hexToRgb(theme.textColor),
          fontSize: 18,
          fontFace: theme.fontFamily,
          paraSpaceAfter: 10
        }
      }));
      slide.addText(rightBullets, {
        x: 7, y: 2.6, w: 5.6, h: 4,
        valign: 'top'
      });
    }
  }
};

const createQuoteSlide = (slide, data, theme) => {
  slide.addText('"', {
    x: 0.5, y: 1, w: 2, h: 2.5,
    fontSize: 180,
    color: hexToRgb(theme.primaryColor),
    fontFace: 'Georgia',
    transparency: 30
  });

  slide.addText(data.quote || '', {
    x: 1.5, y: 2.8, w: 10, h: 2,
    fontSize: 28, italic: true,
    color: hexToRgb(theme.textColor),
    align: 'center',
    fontFace: theme.fontFamily
  });

  if (data.attribution) {
    slide.addShape('rect', {
      x: 5.5, y: 5.2, w: 2, h: 0.05,
      fill: { color: hexToRgb(theme.secondaryColor) }
    });
    slide.addText(`— ${data.attribution}`, {
      x: 1.5, y: 5.5, w: 10, h: 0.6,
      fontSize: 20, bold: true,
      color: hexToRgb(theme.secondaryColor),
      align: 'center',
      fontFace: theme.fontFamily
    });
  }
};

const createStatsSlide = (slide, data, theme) => {
  addTitleBar(slide, theme, 0.35);
  slide.addText(data.title || 'Key Statistics', {
    x: 0.4, y: 0.35, w: 12, h: 1,
    fontSize: 36, bold: true,
    color: hexToRgb(theme.primaryColor),
    fontFace: theme.fontFamily
  });

  if (data.stats && data.stats.length > 0) {
    const statsCount = data.stats.length;
    const cardWidth = (12 / statsCount) - 0.4;
    const spacing = 0.3;

    data.stats.forEach((stat, index) => {
      const x = 0.5 + index * (cardWidth + spacing);
      
      slide.addShape('roundRect', {
        x: x, y: 2, w: cardWidth, h: 4,
        fill: { color: hexToRgb(index % 2 === 0 ? theme.primaryColor : theme.secondaryColor), transparency: 88 },
        line: { color: hexToRgb(index % 2 === 0 ? theme.primaryColor : theme.secondaryColor), width: 2 }
      });

      slide.addText(stat.value || '', {
        x: x, y: 2.8, w: cardWidth, h: 1.5,
        fontSize: 44, bold: true,
        color: hexToRgb(index % 2 === 0 ? theme.primaryColor : theme.secondaryColor),
        align: 'center',
        fontFace: theme.fontFamily
      });

      slide.addText(stat.label || '', {
        x: x, y: 4.5, w: cardWidth, h: 1,
        fontSize: 16,
        color: hexToRgb(theme.textColor),
        align: 'center',
        fontFace: theme.fontFamily
      });
    });
  }
};

const createSectionSlide = (slide, data, theme) => {
  slide.addShape('ellipse', {
    x: 5.67, y: 1.5, w: 2, h: 2,
    fill: { color: hexToRgb(theme.secondaryColor) }
  });
  
  slide.addText(data.title || 'Section', {
    x: 0.5, y: 4, w: 12.33, h: 1.5,
    fontSize: 44, bold: true,
    color: hexToRgb(theme.primaryColor),
    align: 'center',
    fontFace: theme.fontFamily
  });

  slide.addShape('rect', {
    x: 4.67, y: 5.6, w: 4, h: 0.1,
    fill: { color: hexToRgb(theme.secondaryColor) }
  });
};

const createConclusionSlide = (slide, data, theme) => {
  slide.addText(data.title || 'Conclusion', {
    x: 0.6, y: 0.5, w: 8, h: 1,
    fontSize: 40, bold: true,
    color: hexToRgb(theme.primaryColor),
    fontFace: theme.fontFamily
  });

  slide.addShape('rect', {
    x: 0.6, y: 1.5, w: 3, h: 0.1,
    fill: { color: hexToRgb(theme.secondaryColor) }
  });

  if (data.bullets && data.bullets.length > 0) {
    data.bullets.forEach((bullet, i) => {
      const y = 2 + i * 1.4;
      
      slide.addShape('roundRect', {
        x: 0.5, y: y, w: 8, h: 1.2,
        fill: { color: hexToRgb(theme.primaryColor), transparency: 90 },
        line: { color: hexToRgb(theme.primaryColor), width: 1, transparency: 60 }
      });
      
      slide.addShape('ellipse', {
        x: 0.7, y: y + 0.25, w: 0.7, h: 0.7,
        fill: { color: hexToRgb(theme.secondaryColor) }
      });
      slide.addText(`${i + 1}`, {
        x: 0.7, y: y + 0.25, w: 0.7, h: 0.7,
        fontSize: 16, bold: true,
        color: 'FFFFFF',
        align: 'center',
        valign: 'middle',
        fontFace: theme.fontFamily
      });
      
      slide.addText(bullet, {
        x: 1.6, y: y + 0.3, w: 6.5, h: 0.7,
        fontSize: 18,
        color: hexToRgb(theme.textColor),
        fontFace: theme.fontFamily
      });
    });
  }

  if (data.callToAction) {
    slide.addShape('roundRect', {
      x: 3, y: 6.2, w: 7, h: 0.9,
      fill: { color: hexToRgb(theme.primaryColor) }
    });
    slide.addText(data.callToAction, {
      x: 3, y: 6.2, w: 7, h: 0.9,
      fontSize: 22, bold: true,
      color: 'FFFFFF',
      align: 'center',
      valign: 'middle',
      fontFace: theme.fontFamily
    });
  }
};
