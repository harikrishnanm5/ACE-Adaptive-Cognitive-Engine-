import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY_2': JSON.stringify(env.GEMINI_API_KEY_2),
      'process.env.GEMINI_API_KEY_3': JSON.stringify(env.GEMINI_API_KEY_3),
      'process.env.GEMINI_API_KEY_4': JSON.stringify(env.GEMINI_API_KEY_4),
      'process.env.GEMINI_API_KEY_5': JSON.stringify(env.GEMINI_API_KEY_5),
      'process.env.GEMINI_API_KEY_6': JSON.stringify(env.GEMINI_API_KEY_6),
      'process.env.GEMINI_API_KEY_7': JSON.stringify(env.GEMINI_API_KEY_7),
      'process.env.GROQ_API_KEY': JSON.stringify(env.GROQ_API_KEY),
      'process.env.GROQ_API_KEY_2': JSON.stringify(env.GROQ_API_KEY_2),
      'process.env.GROQ_API_KEY_3': JSON.stringify(env.GROQ_API_KEY_3),
      'process.env.GROQ_API_KEY_4': JSON.stringify(env.GROQ_API_KEY_4),
      'process.env.GROQ_API_KEY_5': JSON.stringify(env.GROQ_API_KEY_5),
      'process.env.GROQ_API_KEY_6': JSON.stringify(env.GROQ_API_KEY_6),
      'process.env.DEEPGRAM_API_KEY': JSON.stringify(env.DEEPGRAM_API_KEY),
      'process.env.PRESENTON_API_KEY': JSON.stringify(env.PRESENTON_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true' ? {
        host: 'localhost',
        port: 3000,
        protocol: 'ws',
      } : false,
    },
  };
});
