import {createFederalPublisher} from './handler.ts';
declare const Deno: {
 env:{get(key:string):string|undefined};
 serve(handle:(request:Request)=>Promise<Response>):void;
};
const handle=createFederalPublisher({
 enabled:Deno.env.get('VK_FEDERAL_POSTING_ENABLED')==='true',
 vkToken:Deno.env.get('VK_FEDERAL_GROUP_ACCESS_TOKEN')??'',
 supabaseUrl:Deno.env.get('SUPABASE_URL')??'',
 supabaseKey:Deno.env.get('SUPABASE_ANON_KEY')??'',
});
Deno.serve(handle);
