import {readFile,stat} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';

// Run after `npm run build -- --manifest`. Compare the same build mode/config.
const root=path.resolve(process.argv[2]||'dist');
const manifest=JSON.parse(await readFile(path.join(root,'.vite/manifest.json'),'utf8'));
const app=Object.keys(manifest).find(key=>manifest[key].file.startsWith('assets/PublicApplication-')&&manifest[key].file.endsWith('.js'));
if(!app)throw Error('Public application chunk missing');
const visited=new Set();
function visit(key){if(visited.has(key))return;visited.add(key);for(const dependency of manifest[key].imports||[])visit(dependency);}
visit('index.html');visit(app);
const files=[...visited].map(key=>manifest[key].file).filter(file=>file.endsWith('.js'));
let rawBytes=0,gzipBytes=0;
for(const file of files){const location=path.join(root,file);rawBytes+=(await stat(location)).size;gzipBytes+=gzipSync(await readFile(location)).length;}
console.log(JSON.stringify({rawBytes,gzipBytes,files},null,2));
