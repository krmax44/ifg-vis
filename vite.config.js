import dsv from '@rollup/plugin-dsv';

/**
 * @type {import('vite').UserConfig}
 */
const config = {
  plugins: [dsv()],
  build: {
    rollupOptions: {
      output: {
        // disable hashs in output filenames
        // required for contractor
        // not working for legacy: https://github.com/vitejs/vite/issues/2356
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name].[ext]',
        chunkFileNames: '[name].js'
      }
    }
  },
  resolve: {
    alias: {
      '~': './node_modules/'
    }
  }
};

export default config;
