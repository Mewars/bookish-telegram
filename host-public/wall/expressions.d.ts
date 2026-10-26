export interface WallSticker {id:string;label:string;src:string}
export type WallBodyPart={type:'text';text:string}|({type:'sticker'}&WallSticker);
export const WALL_STICKERS:readonly WallSticker[];
export const EMOJI_GROUPS:readonly {label:string;items:readonly string[]}[];
export function stickerToken(id:string):string;
export function parseWallBody(value:unknown):WallBodyPart[];
export function wallBodyPreview(value:unknown):string;
export function renderWallBody(value:unknown,className?:string):HTMLDivElement;
export function attachExpressionPicker(field:HTMLTextAreaElement):{element:HTMLDivElement;value:()=>string;clear:()=>void};
