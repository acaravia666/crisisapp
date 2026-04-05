/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Background scale
        'bg-primary':      '#0A0A0C',
        'bg-secondary':    '#16161D',
        'bg-tertiary':     '#1C1C24',
        'bg-glass-border': 'rgba(255,255,255,0.12)',
        // Shorthand aliases used in JSX
        secondary:  '#16161D',
        tertiary:   '#1C1C24',
        // Urgency palette
        'urgency-emergency': '#EF4444',
        'urgency-urgent':    '#EA580C',
        'urgency-soon':      '#F59E0B',
        'urgency-normal':    '#3B82F6',
        // Accent
        'accent-cyan':   '#06B6D4',
        'accent-purple': '#8B5CF6',
      },
    },
  },
  plugins: [],
};
