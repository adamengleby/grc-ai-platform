import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          light: "hsl(var(--primary-light))",
          dark: "hsl(var(--primary-dark))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          dark: "hsl(var(--secondary-dark))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          light: "hsl(var(--destructive-light))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          light: "hsl(var(--accent-light))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          light: "hsl(var(--success-light))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          light: "hsl(var(--warning-light))",
        },
        // GRC-specific status colors
        status: {
          good: "hsl(var(--status-good))",
          medium: "hsl(var(--status-medium))",
          critical: "hsl(var(--status-critical))",
          pending: "hsl(var(--status-pending))",
          // Legacy aliases
          compliant: "hsl(var(--status-compliant))",
          'at-risk': "hsl(var(--status-at-risk))",
          'non-compliant': "hsl(var(--status-non-compliant))",
        },
        // Gradient color stops
        gradient: {
          'blue-start': "hsl(var(--gradient-blue-start))",
          'blue-end': "hsl(var(--gradient-blue-end))",
          'success-start': "hsl(var(--gradient-success-start))",
          'success-end': "hsl(var(--gradient-success-end))",
          'warm-start': "hsl(var(--gradient-warm-start))",
          'warm-end': "hsl(var(--gradient-warm-end))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        'gradient-blue': 'linear-gradient(135deg, hsl(var(--gradient-blue-start)), hsl(var(--gradient-blue-end)))',
        'gradient-success': 'linear-gradient(135deg, hsl(var(--gradient-success-start)), hsl(var(--gradient-success-end)))',
        'gradient-warm': 'linear-gradient(135deg, hsl(var(--gradient-warm-start)), hsl(var(--gradient-warm-end)))',
        'gradient-subtle': 'linear-gradient(135deg, hsl(var(--muted)), hsl(var(--card)))',
      },
      boxShadow: {
        'card': 'var(--shadow-base)',
        'card-hover': 'var(--shadow-md)',
        'card-lg': 'var(--shadow-lg)',
        'inner-light': 'inset 0 1px 0 0 rgb(255 255 255 / 0.05)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-green": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-10px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-green": "pulse-green 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;