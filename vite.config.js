import dsv from '@rollup/plugin-dsv';
import legacy from '@vitejs/plugin-legacy';

export default {
  plugins: [dsv(), legacy({ targets: ['defaults', 'not IE 11'] })]
};
