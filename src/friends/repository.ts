import type { SupabaseClient } from '@supabase/supabase-js';

export type NearbyPoint={latitude:number|null;longitude:number|null;expires_at:string|null};
export type NearbyFriend=NearbyPoint&{id:string;name:string;accepted:boolean;incoming:boolean;updated_at:string|null};
export type NearbyState={self:NearbyPoint&{display_name:string;invite_code:string|null;invite_expires:string|null};friends:NearbyFriend[];blocked:{id:string;name:string}[]};

export async function nearbyCall<T=void>(client:SupabaseClient|null,name:string,params?:Record<string,unknown>):Promise<T> {
  if(!client)throw Error('Сервис друзей пока не подключён.');
  const {data,error}=await client.rpc(name,params);
  if(error){
    if(error.code==='54000')throw Error('На сегодня достаточно приглашений. Попробуйте завтра.');
    if(name==='nearby_request')throw Error('Код недействителен или приглашение уже недоступно. Попросите друга создать новый код.');
    throw Error('Не удалось выполнить действие. Проверьте соединение и повторите.');
  }
  return data as T;
}
export const getNearbyState=(client:SupabaseClient|null)=>nearbyCall<NearbyState>(client,'nearby_state');
export function activePoint(point:NearbyPoint,now=Date.now()):boolean {
  return typeof point.latitude==='number'&&Number.isFinite(point.latitude)&&Math.abs(point.latitude)<=90&&
    typeof point.longitude==='number'&&Number.isFinite(point.longitude)&&Math.abs(point.longitude)<=180&&
    typeof point.expires_at==='string'&&Date.parse(point.expires_at)>now;
}
export function approximateCoordinates(latitude:number,longitude:number):{p_lat:number;p_lon:number} {
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)
    throw Error('Не удалось определить местоположение.');
  return {p_lat:Math.round(latitude*100)/100,p_lon:Math.round(longitude*100)/100};
}
