/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // Google AI Studio / Material 3 Colors
        'google-bg': {
          DEFAULT: '#FFFFFF',
          dark: '#131314', // Google Dark
        },
        'google-surface': {
          DEFAULT: '#F0F4F9', // Light Blue-Grey
          dark: '#1E1F20', // Dark Grey
        },
        'google-primary': {
          DEFAULT: '#0B57D0', // Google Blue
          dark: '#A8C7FA', // Light Blue
        },
        'google-on-primary': {
          DEFAULT: '#FFFFFF',
          dark: '#002F6C', // Dark Blue text on light blue
        },
        'google-text': {
          DEFAULT: '#1F1F1F',
          dark: '#E3E3E3',
        },
        'google-text-secondary': {
          DEFAULT: '#444746',
          dark: '#C4C7C5',
        },
        'google-outline': {
          DEFAULT: '#747775',
          dark: '#8E918F',
        },
        // Semantic financial colors (Material 3 Red/Green)
        'google-red': {
          DEFAULT: '#B3261E', 
          dark: '#F2B8B5',
        },
        'google-green': {
          DEFAULT: '#146C2E',
          dark: '#6DD58C',
        }
      }
    },
  },
  plugins: [],
};
