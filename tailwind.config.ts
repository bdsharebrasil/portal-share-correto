import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        brand: {
          50: "#eff8ff", 100: "#dceeff", 200: "#bfe0ff", 300: "#8ec5f4",
          400: "#5aa5e8", 500: "#3386d5", 600: "#2872bd", 700: "#205b97",
          800: "#1d4b7b", 900: "#1c4166", 950: "#112a43",
        },
        azul: {
          50: "#eef6ff", 100: "#dcecff", 200: "#bddcff", 300: "#8ec4f1",
          400: "#5ba4df", 500: "#347fc8", 600: "#2869aa", 700: "#24578d",
          800: "#234a74", 900: "#223f60", 950: "#142b43",
        },
        noite: {
          950: "#070c15", 900: "#0a1020", 850: "#0e1625", 800: "#111b2b",
          700: "#172337", 600: "#1d2c42", 500: "#2a3d57", 400: "#647793",
          300: "#92a2b8", 200: "#c2ccda", 100: "#e7edf5",
        },
        ctm: {
          teal: "#35b7cf",
          "teal-light": "#61c9dc",
          navy: "#0a1020",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
          secondary: "hsl(var(--card-secondary))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        border: {
          DEFAULT: "hsl(var(--border))",
          subtle: "hsl(var(--border-subtle))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
          dark: "hsl(var(--primary-dark))",
          light: "#5a9ed8",
          dim: "#2b6a9f",
          accent: "#3a7fbd",
          muted: "hsl(var(--primary-muted))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        bg: {
          card: "hsl(var(--card))",
          surface: "hsl(var(--surface))",
          raised: "hsl(var(--surface-raised))",
          hover: "hsl(var(--surface-hover))",
        },
        ink: {
          DEFAULT: "hsl(var(--text-primary))",
          bright: "hsl(var(--text-bright))",
          muted: "hsl(var(--text-muted))",
          faint: "hsl(var(--text-faint))",
        },
        navy: {
          950: "#080d16", 900: "#0d1521", 850: "#101927", 800: "#152033", 700: "#1b2940",
        },
        cyan: {
          DEFAULT: "#35b7cf",
          dim: "#258ca4",
          faint: "rgba(53, 183, 207, 0.08)",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "#dc4f4f",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        display: ["Inter", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-card": "var(--gradient-card)",
        "gradient-subtle": "var(--gradient-subtle)",
      },
      boxShadow: {
        primary: "var(--shadow-primary)",
        card: "var(--shadow-card)",
        elevated: "var(--shadow-elevated)",
        soft: "var(--shadow-soft)",
      },
      borderRadius: {
        xl: "14px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        DEFAULT: "10px",
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
        "slide-in-from-top": {
          from: { transform: "translateY(-10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in-from-top": "slide-in-from-top 0.25s ease-out",
      },
      scale: {
        102: "1.02",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
