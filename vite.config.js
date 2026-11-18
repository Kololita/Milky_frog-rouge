import {defineConfig} from 'vite';

export default defineConfig({
  server:{
    host:'127.0.0.1',port:5173,strictPort:true,
    headers:{'Cache-Control':'no-cache'},
    watch:{
      // Windows may exclusively lock Electron runtime files during packaging.
      // These trees are not web source and must never crash the dev watcher.
      // Watch UI images so newly added reward icons are available immediately.
      ignored:['**/release/**','**/output/**','**/dist/**','**/tools/**','**/assets-source/**','**/docs/**','**/desktop/**','**/public/models/**'],
    },
  },
});
