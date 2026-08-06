import type { Config } from "tailwindcss";

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
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        ctm: {
          teal: '#2dd4bf',
          'teal-light': '#5eead4',
          navy: '#0f1628'
        },
        border: {
          DEFAULT: 'hsl(var(--border))',
          subtle: '#1a2540'
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        ink: {
          DEFAULT: '#c3d0e8',
          bright: '#eaf1fb',
          muted: '#7f92b3',
          faint: '#5a6c8a'
        },
        bg: {
          card: '#0f1628',
          surface: '#141d33',
          raised: '#111a2e',
          hover: '#1a2540'
        },
        danger: '#ef4444',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          glow: 'hsl(var(--primary-glow))',
          dark: 'hsl(var(--primary-dark))',
          light: '#5a9aee',
          dim: '#2a5fa8',
          accent: '#3b7dd8',
          muted: 'rgba(59, 125, 216, 0.15)'
        },

        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
          secondary: 'hsl(var(--card-secondary))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        },
        'folder-back': 'hsl(var(--folder-back))',
        'folder-tab': 'hsl(var(--folder-tab))',
        'folder-front': 'hsl(var(--folder-front))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',

        navy: {
    950: '#080c14',
    900: '#0f1623',
    850: '#111827',
    800: '#131d2e',
    700: '#1c293f',
  },
  cyan: {
    DEFAULT: '#22d3ee',
    dim: '#06b6d4',
    faint: 'rgba(34,211,238,0.12)',
  }

      },
      fontFamily: {
  sans: ['Inter', 'sans-serif'],
  display: ['Inter', 'sans-serif'],
  body: ['Inter', 'sans-serif'],

      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-card': 'var(--gradient-card)',
        'gradient-subtle': 'var(--gradient-subtle)'
      },
      boxShadow: {
        'primary': 'var(--shadow-primary)',
        'card': 'var(--shadow-card)',
        'elevated': 'var(--shadow-elevated)'
      },
      transitionTimingFunction: {
        'smooth': 'var(--transition-smooth)',
        'bounce': 'var(--transition-bounce)'
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        DEFAULT: '0.5rem'
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        },
        'scroll-left': {
          from: {
            transform: 'translateX(100%)'
          },
          to: {
            transform: 'translateX(-100%)'
          }
        },
        'scroll-right': {
          from: {
            transform: 'translateX(-100%)'
          },
          to: {
            transform: 'translateX(100%)'
          }
        },
        'plane-float': {
          '0%, 100%': {
            transform: 'translateY(0px)'
          },
          '50%': {
            transform: 'translateY(-8px)'
          }
        },
        'dash': {
          to: {
            strokeDashoffset: '-1000'
          }
        },
        'slide-in-from-top': {
          from: {
            transform: 'translateY(-100%)',
            opacity: '0'
          },
          to: {
            transform: 'translateY(0)',
            opacity: '1'
          }
        },
        'slide-out-to-top': {
          from: {
            transform: 'translateY(0)',
            opacity: '1'
          },
          to: {
            transform: 'translateY(-100%)',
            opacity: '0'
          }
        },
        'fade-in': {
          from: {
            opacity: '0',
            transform: 'scale(0.95)'
          },
          to: {
            opacity: '1',
            transform: 'scale(1)'
          }
        },
        'fade-out': {
          from: {
            opacity: '1',
            transform: 'scale(1)'
          },
          to: {
            opacity: '0',
            transform: 'scale(0.95)'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'scroll-left': 'scroll-left 8s linear infinite',
        'scroll-right': 'scroll-right 10s linear infinite',
        'plane-float': 'plane-float 3s ease-in-out infinite',
        'route-dash': 'dash 60s linear infinite',
        'slide-in-from-top': 'slide-in-from-top 0.3s cubic-bezier(0.21, 1.02, 0.73, 1)',
        'slide-out-to-top': 'slide-out-to-top 0.25s cubic-bezier(0.21, 1.02, 0.73, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-out': 'fade-out 0.2s ease-out'
      },
      scale: {
        '102': '1.02'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;