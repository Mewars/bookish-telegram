/* global process */
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
const fixture=name=>fileURLToPath(new URL(name,import.meta.url));
const server=await createServer({
  configFile:false,
  plugins:[react(),{name:'gallery-test-images',configureServer(server){
    server.middlewares.use('/test-images/',(_req,res)=>{
      res.setHeader('Content-Type','image/svg+xml');
      res.end('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="gold"/></svg>');
    });
  }}],
  resolve:{alias:[
    {find:'../lib/supabase',replacement:fixture('supabase.mjs')},
    {find:'./photos',replacement:fixture('photos.mjs')},
  ]},
  server:{host:'127.0.0.1',port:4179,strictPort:true},
});
await server.listen();
process.on('SIGTERM',()=>{void server.close();});
