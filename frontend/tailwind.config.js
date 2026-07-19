/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          hover: 'var(--bg-surface-hover)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
        },
      },
      borderColor: {
        subtle: 'var(--border-subtle)',
        DEFAULT: 'var(--border-default)',
        strong: 'var(--border-strong)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
