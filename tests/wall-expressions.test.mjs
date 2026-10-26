import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {WALL_STICKERS,EMOJI_GROUPS,parseWallBody,stickerToken,wallBodyPreview} from '../host-public/wall/expressions.js';

test('24 unique local stickers exist; the manifest never accepts arbitrary URLs',()=>{
 assert.equal(WALL_STICKERS.length,24);
 assert.equal(new Set(WALL_STICKERS.map(item=>item.id)).size,24);
 assert.equal(readdirSync(new URL('../host-public/wall/stickers/',import.meta.url)).filter(file=>file.endsWith('.webp')).length,24);
 for(const sticker of WALL_STICKERS){
  assert.match(sticker.src,/^\/wall\/stickers\/sable-\d{2}\.webp$/);
  const bytes=readFileSync(new URL('../host-public'+sticker.src,import.meta.url));
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.ok(bytes.length<60000);
  assert.equal(parseWallBody(stickerToken(sticker.id))[0].label,sticker.label);
 }
 assert.equal(stickerToken('https://evil.invalid/image.svg'),'');
 assert.equal(stickerToken('sable-25'),'');
 assert.ok(EMOJI_GROUPS.flatMap(group=>group.items).includes('❤️'));
 assert.ok(EMOJI_GROUPS.flatMap(group=>group.items).length>150);
});
test('text, emojis and unknown tokens stay literal; rendering is bounded and shared previews are readable',()=>{
 const source='Привет 😊\n'+stickerToken('sable-01')+'<script>alert(1)</script>';
 const parts=parseWallBody(source);
 assert.deepEqual(parts.map(part=>part.type),['text','sticker','text']);
 assert.equal(parts[0].text,'Привет 😊\n');
 assert.equal(parts[2].text,'<script>alert(1)</script>');
 for(const body of ['[ryadom-sticker:sable-99]','[ryadom-sticker:../../secret]','<img src=x onerror=alert(1)>'])assert.deepEqual(parseWallBody(body),[{type:'text',text:body}]);
 assert.equal(parseWallBody(stickerToken('sable-01').repeat(100)).filter(part=>part.type==='sticker').length,3);
 assert.equal(wallBodyPreview(stickerToken('sable-02')),'Кофе рядом?');
 assert.deepEqual(parseWallBody(null),[]);
 const code=readFileSync(new URL('../host-public/wall/expressions.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/innerHTML|insertAdjacentHTML/);
});
