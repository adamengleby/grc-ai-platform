/**
 * Multi-tenant theme configuration system
 * Allows tenants to customize primary colors while maintaining professional design
 */

export interface TenantTheme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary?: string;
    accent?: string;
    logo?: string;
  };
  branding?: {
    logoUrl?: string;
    companyName?: string;
    favicon?: string;
  };
}

export const defaultThemes: Record<string, TenantTheme> = {
  default: {
    id: 'default',
    name: 'Corporate Blue',
    colors: {
      primary: '222 78% 33%', // Deep Corporate Blue
      secondary: '220 13% 28%', // Professional Gray
      accent: '160 84% 39%', // Trust Green
    },
  },
  financial: {
    id: 'financial',
    name: 'Financial Services',
    colors: {
      primary: '200 80% 35%', // Financial Blue
      secondary: '220 13% 28%', // Professional Gray
      accent: '142 76% 36%', // Financial Green
    },
  },
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare',
    colors: {
      primary: '210 90% 45%', // Healthcare Blue
      secondary: '220 13% 28%', // Professional Gray
      accent: '340 82% 52%', // Healthcare Pink
    },
  },
  government: {
    id: 'government',
    name: 'Government',
    colors: {
      primary: '230 60% 30%', // Government Navy
      secondary: '220 13% 28%', // Professional Gray
      accent: '200 50% 40%', // Government Blue
    },
  },
  manufacturing: {
    id: 'manufacturing',
    name: 'Manufacturing',
    colors: {
      primary: '15 80% 40%', // Industrial Orange
      secondary: '220 13% 28%', // Professional Gray
      accent: '25 85% 45%', // Manufacturing Amber
    },
  },
};

/**
 * Apply a theme to the document root
 */
export function applyTenantTheme(theme: TenantTheme): void {
  const root = document.documentElement;
  
  // Update CSS custom properties
  root.style.setProperty('--primary', theme.colors.primary);
  if (theme.colors.secondary) {
    root.style.setProperty('--secondary', theme.colors.secondary);
  }
  if (theme.colors.accent) {
    root.style.setProperty('--accent', theme.colors.accent);
  }
  
  // Update chat-specific colors to maintain consistency
  root.style.setProperty('--chat-user-bg', theme.colors.primary);
  root.style.setProperty('--ring', theme.colors.primary);
  
  // Store theme preference
  localStorage.setItem('tenant-theme', JSON.stringify(theme));
}

/**
 * Get the stored theme for a tenant
 */
export function getTenantTheme(tenantId?: string): TenantTheme {
  try {
    const stored = localStorage.getItem('tenant-theme');
    if (stored) {
      const theme = JSON.parse(stored);
      // Validate theme has required properties
      if (theme.id && theme.colors?.primary) {
        return theme;
      }
    }
  } catch (error) {
    console.warn('Failed to load tenant theme:', error);
  }
  
  // Return default theme
  return defaultThemes.default;
}

/**
 * Generate a custom theme from tenant preferences
 */
export function createCustomTheme(
  tenantId: string,
  primaryColor: string,
  options: {
    name?: string;
    secondary?: string;
    accent?: string;
    branding?: TenantTheme['branding'];
  } = {}
): TenantTheme {
  return {
    id: `custom-${tenantId}`,
    name: options.name || 'Custom Theme',
    colors: {
      primary: primaryColor,
      secondary: options.secondary || '220 13% 28%',
      accent: options.accent || '160 84% 39%',
    },
    branding: options.branding,
  };
}

/**
 * Validate that a color string is a valid HSL format
 */
export function isValidHSLColor(color: string): boolean {
  const hslRegex = /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/;
  return hslRegex.test(color.trim());
}

/**
 * Convert hex color to HSL format for CSS custom properties
 */
export function hexToHSL(hex: string): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(cleanHex.substr(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substr(2, 2), 16) / 255;
  const b = parseInt(cleanHex.substr(4, 2), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number, s: number, l: number;
  
  l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
      default:
        h = 0;
        break;
    }
    h /= 6;
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Initialize theme system on app startup
 */
export function initializeThemeSystem(tenantId?: string): void {
  const theme = getTenantTheme(tenantId);
  applyTenantTheme(theme);
  
  // Listen for system dark mode changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addListener((e) => {
    if (e.matches) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });
  
  // Apply initial dark mode if preferred
  if (mediaQuery.matches && !localStorage.getItem('theme')) {
    document.documentElement.classList.add('dark');
  }
}