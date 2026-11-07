import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { defineConfig, type Plugin } from 'vite';

const SFX_DIR = resolve(__dirname, 'assets/sfx');

/** Serve and emit `assets/sfx/` without hashing. Deploy uploads `dist/assets/` as-is. */
function sfxAssets(): Plugin {
  return {
    name: 'dianlei-sfx',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url?.split('?')[0] ?? '';
        if (!raw.startsWith('/assets/sfx/')) return next();
        const name = raw.slice('/assets/sfx/'.length);
        if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) return next();
        const file = resolve(SFX_DIR, name);
        if (!existsSync(file)) return next();
        res.setHeader(
          'Content-Type',
          name.endsWith('.ogg') ? 'audio/ogg' : 'text/plain; charset=utf-8'
        );
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      if (!existsSync(SFX_DIR)) return;
      for (const name of readdirSync(SFX_DIR)) {
        if (!name.endsWith('.ogg') && name !== 'LICENSE.md') continue;
        this.emitFile({
          type: 'asset',
          fileName: `assets/sfx/${name}`,
          source: readFileSync(resolve(SFX_DIR, name)),
        });
      }
    },
  };
}

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
    plugins: [sfxAssets()],
    server: {
      port: 3000,
      host: true,
    },
  };
});
