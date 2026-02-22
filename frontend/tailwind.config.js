/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'monospace'],
      },
      colors: {
        matrix: {
          bg: '#0a0e0f',
          surface: '#11181a',
          border: '#1e2d31',
          dim: '#2d4047',
          green: '#00ff88',
          'green-dim': '#00cc6a',
          cyan: '#00d4ff',
          'cyan-dim': '#00a8cc',
          amber: '#ffb800',
          red: '#ff3366',
          purple: '#b366ff',
        },
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 255, 136, 0.15)',
        'glow-cyan': '0 0 20px rgba(0, 212, 255, 0.15)',
      },
      animation: {
        'blink': 'blink 1s step-end infinite',
        'scan': 'scan 3s linear infinite',
      },
      keyframes: {
        blink: {
          '50%': { opacity: '0' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
}
