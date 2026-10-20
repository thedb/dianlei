import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    // Use relative paths in production for deployment flexibility
    // Works under any folder path and in WeChat mini game shell
    base: isProd ? './' : '/',
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    define: {
      __ASSET_BASE__: JSON.stringify(
        isProd
          ? (process.env.ASSET_BASE_URL ??
              'https://cdn.it-consultis.com/vibeCoding/dianlei/assets/')
          : '/assets/'
      ),
    },
    build: {
      target: 'es2020',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: !isProd,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
    server: {
      port: 3000,
      host: true,
    },
  };
});
