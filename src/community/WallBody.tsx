import {parseWallBody} from '../../host-public/wall/expressions.js';
import '../../host-public/wall/expressions.css';
export function WallBody({value}:{value:string}){
 return <div className="wall-expression-body">{parseWallBody(value).map((part,index)=>part.type==='text'?part.text:<img key={index} className="wall-sticker" src={part.src} alt={part.label} width={256} height={256} loading="lazy"/>)}</div>;
}
