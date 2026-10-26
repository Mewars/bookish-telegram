const actor=()=>localStorage.getItem('wall-test-actor')||'resident';
const initial={posts:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',city:'Енисейск',author_id:'resident',title:'Запись жителя для проверки',body:'Подробный текст записи жителя города.',post_type:'post',status:'pending',created_at:'2026-10-20T10:00:00Z',pinned_at:null}],reasons:[]};
const read=()=>JSON.parse(localStorage.getItem('wall-test-db')||JSON.stringify(initial));
const write=db=>localStorage.setItem('wall-test-db',JSON.stringify(db));
function query(table){
 const filters=[];let change=null,single=false;
 const q={
 select(){return q},eq(key,value){filters.push(row=>row[key]===value);return q},
 in(key,values){filters.push(row=>values.includes(row[key]));return q},
 order(){return q},limit(){return q},update(value){change=value;return q},
 maybeSingle(){single=true;return Promise.resolve(run())},
 then(resolve,reject){return Promise.resolve(run()).then(resolve,reject)}
 };
 function run(){
  const db=read(),who=actor();
  const tables={
   city_directory:[{name:'Енисейск',active:true},{name:'Лесосибирск',active:true},{name:'Новый город',active:true}],
   city_admin_access:who==='owner'?[{user_id:who,city:'*',role:'owner',active:true}]:[],
   community_wall_settings:[{city:'Енисейск',posts_mode:'review',comments_mode:'open'},{city:'Лесосибирск',posts_mode:'review',comments_mode:'open'}],
   community_comments:(db.comments||[]).filter(c=>c.status==='published'||c.author_id===who||who==='owner'),
   community_posts:db.posts.filter(p=>p.status==='published'||p.author_id===who||who==='owner'),
   community_post_review_reasons:db.reasons.filter(r=>who==='owner'||db.posts.some(p=>p.id===r.post_id&&p.author_id===who))
  };
  let rows=(tables[table]||[]).filter(row=>filters.every(filter=>filter(row)));
  if(change){
   rows=rows.filter(p=>p.author_id===who&&['draft','rejected'].includes(p.status));
   if(localStorage.getItem('wall-zero-update'))rows=[];
   rows.forEach(row=>Object.assign(row,change));write(db);
  }
  return {data:single?(rows[0]||null):rows,error:null};
 }
 return q;
}
export function c(){
 return {
  from:query,
  auth:{
   getSession:async()=>({data:{session:{user:{id:actor(),email:actor()+'@example.invalid',user_metadata:{}}}}}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
   signOut:async()=>({error:null})
  },
  rpc:async(name,args={})=>{
   if(name==='antispam_public_config'){window.wallVerificationCount=(window.wallVerificationCount||0)+1;return {data:{auth_enabled:false,content_enabled:false,site_key:null},error:null};}
   const db=read(),who=actor();
   const post=db.posts.find(p=>p.id===(args.p_id||args.p_post_id));
   const denied=()=>({data:null,error:{message:'Not authorized'}});
   if(name==='community_visible_author_cards')return {data:args.p_ids.map(id=>({author_id:id,display_name:'Житель города'})),error:null};
   if(name==='community_like_summary')return {data:[],error:null};
   if(name==='review_community_post_with_reason'||name==='review_community_post'){
    if(who!=='owner'||!post||post.status!=='pending')return denied();
    if(!args.p_approve&&(!args.p_reason||args.p_reason.trim().length<3))return denied();
    post.status=args.p_approve?'published':'rejected';
    db.reasons=db.reasons.filter(r=>r.post_id!==post.id);
    if(!args.p_approve)db.reasons.push({post_id:post.id,reason:args.p_reason.trim(),reviewed_at:'2026-10-20T10:00:00Z'});
    write(db);return {data:null,error:null};
   }
   if(name==='community_submit_post'){
    if(window.wallSubmitFailures>0){window.wallSubmitFailures--;return {data:null,error:{message:'Synthetic retry required'}};}
    if(!post||post.author_id!==who||!['draft','rejected'].includes(post.status))return denied();
    post.status='pending';write(db);return {data:'pending',error:null};
   }
   if(name==='submit_community_comment'){
    if(!post||post.status!=='published')return denied();
    db.comments??=[];const id=crypto.randomUUID();db.comments.push({id,post_id:post.id,author_id:who,body:args.p_body,status:'published',created_at:new Date().toISOString()});write(db);return {data:id,error:null};
   }
   if(name==='create_community_post'){
    const id=crypto.randomUUID();
    db.posts.push({id,city:args.p_city,author_id:who,post_type:args.p_type,title:args.p_title,body:args.p_body,status:'draft',created_at:new Date().toISOString()});
    write(db);return {data:id,error:null};
   }
   return {data:[],error:null};
  }
 };
}
