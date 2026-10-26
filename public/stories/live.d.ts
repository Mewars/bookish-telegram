import type {SupabaseClient} from '@supabase/supabase-js';
export function mountCityStories(root:HTMLElement,options:{city:string;client:SupabaseClient}):()=>void;
export function prepareStoryPhoto(file:File):Promise<Blob>;
