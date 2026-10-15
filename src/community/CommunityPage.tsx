import { useEffect,useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
  archiveCommunityPost,canEditCityNews,createCommunityPost,myCommunityPosts,pendingCommunityComments,
  pendingCommunityPosts,postTypeNames,publicCommunityComments,publishCityNews,
  mayModerateCommunityMaterial,
  publishedPosts,reviewCommunityComment,reviewCommunityPost,sendCommunityComment,
  submitCommunityPost,updateCommunityDraft,validatePost,
} from './repository';
import type { CommunityComment,CommunityPost,CommunityPostType,ModerationCommunityComment } from './repository';
import './community.css';

type View='feed'|'mine'|'moderate'|'comments';
type Filter='all'|CommunityPostType;
const formatDate=(value:string)=>new Date(value).toLocaleString('ru-RU',{day:'numeric',month:'short',year:'numeric'});
function explain(error:unknown):string {
  return error instanceof Error?error.message:'Не удалось выполнить действие. Повторите попытку.';
}

export function CommunityPage({city,openLogin}:{city:string;openLogin:()=>void}){
  const {state}=useAuth();
  const userId=state.status==='authenticated'?state.user.id:null;
  return <CommunitySession key={JSON.stringify([city,userId])} city={city} userId={userId} openLogin={openLogin}/>;
}
function CommunitySession({city,userId,openLogin}:{city:string;userId:string|null;openLogin:()=>void}){
  const [view,setView]=useState<View>('feed');
  const [filter,setFilter]=useState<Filter>('all');
  const [items,setItems]=useState<CommunityPost[]>([]);
  const [pendingComments,setPendingComments]=useState<ModerationCommunityComment[]>([]);
  const [isEditor,setIsEditor]=useState(false);
  const [title,setTitle]=useState('');
  const [body,setBody]=useState('');
  const [kind,setKind]=useState<'post'|'question'|'news'>('post');
  const [composer,setComposer]=useState(false);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [selectedPost,setSelectedPost]=useState<string|null>(null);
  const [comments,setComments]=useState<CommunityComment[]>([]);
  const [commentsFor,setCommentsFor]=useState<string|null>(null);
  const [commentBody,setCommentBody]=useState('');
  const [revision,setRevision]=useState(0);
  const [loadedKey,setLoadedKey]=useState('');
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState('');

  useEffect(()=>{
    let live=true;
    if(userId){
      canEditCityNews(supabase,city).then(enabled=>{if(live)setIsEditor(enabled);})
        .catch(()=>{if(live)setIsEditor(false);});
    }
    return ()=>{live=false;};
  },[city,userId]);

  const requestKey=[view,city,userId??'guest',revision,isEditor].join('|');
  const loading=loadedKey!==requestKey;
  useEffect(()=>{
    let live=true;
    const load=async()=>{
      if(view==='comments'){
        const rows=isEditor?await pendingCommunityComments(supabase,city):[];
        if(live)setPendingComments(rows);
        return;
      }
      const rows=view==='mine'
        ?userId?await myCommunityPosts(supabase,userId,city):[]
        :view==='moderate'
          ?isEditor?await pendingCommunityPosts(supabase,city):[]
          :await publishedPosts(supabase,city);
      if(live)setItems(rows);
    };
    void load().catch(reason=>{if(live)setFeedback(explain(reason));})
      .finally(()=>{if(live)setLoadedKey(requestKey);});
    return ()=>{live=false;};
  },[requestKey,view,city,userId,revision,isEditor]);

  useEffect(()=>{
    let live=true;
    if(!selectedPost)return ()=>{live=false;};
    void publicCommunityComments(supabase,selectedPost).then(rows=>{
      if(live){setComments(rows);setCommentsFor(selectedPost);}
    }).catch(reason=>{if(live)setFeedback(explain(reason));});
    return ()=>{live=false;};
  },[selectedPost,revision]);

  const doAction=async(action:()=>Promise<void>,onSuccess?:()=>void)=>{
    if(busy)return;
    setBusy(true);setFeedback('');
    try{await action();setRevision(x=>x+1);onSuccess?.();}
    catch(e){setFeedback(explain(e));}
    finally{setBusy(false);}
  };
  const onCompose=()=>{
    if(!userId){openLogin();return;}
    setEditingId(null);setTitle('');setBody('');setKind('post');setComposer(value=>!value);
  };
  const savePost=()=>{
    const invalid=validatePost(title,body);
    if(invalid){setFeedback(invalid);return;}
    const action=editingId && userId
      ?()=>updateCommunityDraft(supabase,editingId,userId,title,body)
      :kind==='news'
        ?()=>publishCityNews(supabase,city,title,body)
        :()=>createCommunityPost(supabase,city,kind,title,body);
    void doAction(action,()=>{
      const wasEditing=Boolean(editingId);
      setComposer(false);setEditingId(null);setTitle('');setBody('');setView(kind==='news'?'feed':'mine');
      setFeedback(wasEditing?'Черновик обновлён.':kind==='news'?'Редакционная новость опубликована.':'Черновик сохранён. Теперь отправьте его на проверку.');
    });
  };
  const editDraft=(post:CommunityPost)=>{
    if(!userId||post.author_id!==userId||!['draft','rejected'].includes(post.status))return;
    setView('mine');setEditingId(post.id);setTitle(post.title);setBody(post.body);
    setKind(post.post_type as 'post'|'question');setComposer(true);setFeedback('');
  };
  const chooseView=(next:View)=>{
    if(next==='mine'&&!userId){openLogin();return;}
    setView(next);setSelectedPost(null);setFeedback('');setEditingId(null);setComposer(false);
  };
  const shown=items.filter(item=>view!=='feed'||filter==='all'||item.post_type===filter);
  return <section className="community-page">
    <header className="community-hero">
      <span>РЯДОМ · ЗАКРЫТАЯ БЕТА</span>
      <h1>Городская лента · {city}</h1>
      <p>Городские новости, вопросы соседей и публикации жителей. Всё внутри «РЯДОМ».</p>
      <nav className="community-tabs" aria-label="Городская лента">
        <button aria-pressed={view==='feed'} onClick={()=>chooseView('feed')}>Лента</button>
        <button aria-pressed={view==='mine'} onClick={()=>chooseView('mine')}>Мои публикации</button>
        {isEditor&&<button aria-pressed={view==='moderate'} onClick={()=>chooseView('moderate')}>Посты на проверке</button>}
        {isEditor&&<button aria-pressed={view==='comments'} onClick={()=>chooseView('comments')}>Комментарии на проверке</button>}
      </nav>
    </header>
    {feedback&&<p className="community-feedback" role="status">{feedback}</p>}
    {(view==='feed'||view==='mine')&&<div className="community-toolbar">
      <div>
        <h2>{view==='feed'?'Что нового в городе':'Мои публикации'}</h2>
        <p>{view==='feed'?'Только проверенные публикации.':'Подготовьте пост и отправьте на модерацию.'}</p>
      </div>
      <button className="community-primary" onClick={onCompose}>{composer?'Закрыть форму':'+ Написать пост'}</button>
    </div>}
    {composer&&<form className="community-compose" onSubmit={event=>{event.preventDefault();savePost();}}>
      <h3>{editingId?'Редактирование черновика':'Новая публикация'}</h3>
      <label>Тип
        <select disabled={Boolean(editingId)} value={kind} onChange={e=>setKind(e.target.value as 'post'|'question'|'news')}>
          <option value="post">Пост жителя</option>
          <option value="question">Вопрос</option>
          {isEditor&&<option value="news">Официальная городская новость</option>}
        </select>
      </label>
      <label>Заголовок
        <input required minLength={5} maxLength={160} value={title}
          onChange={e=>setTitle(e.target.value)} placeholder="О чём хотите рассказать?"/>
      </label>
      <label>Текст публикации
        <textarea required minLength={10} maxLength={5000} rows={6} value={body}
          onChange={e=>setBody(e.target.value)} placeholder="Напишите своими словами, что происходит в городе…"/>
      </label>
      <p>Новые посты жителей публикуются только после проверки. Фотографии появятся после отдельной проверки безопасной загрузки.</p>
      <button type="submit" className="community-primary" disabled={busy}>{editingId?'Сохранить изменения':kind==='news'?'Опубликовать новость':'Сохранить черновик'}</button>
    </form>}
    {view==='feed'&&<div className="community-filters" role="group" aria-label="Фильтр ленты">
      {(['all','news','post','question'] as const).map(item=><button key={item} aria-pressed={filter===item}
        onClick={()=>setFilter(item)}>{item==='all'?'Все':item==='news'?'Новости':item==='post'?'Посты':'Вопросы'}</button>)}
    </div>}
    {(view==='feed'||view==='mine'||view==='moderate')&&(loading
      ?<p className="community-empty" role="status">Загружаем публикации…</p>
      :shown.length===0?<div className="community-empty">
        <h2>Публикаций пока нет</h2>
        <p>{view==='feed'?'Проверенные новости и посты появятся здесь. Никаких вымышленных историй.':view==='mine'?'Начните с первого собственного поста.':'Нет новых постов на проверке.'}</p>
      </div>
      :<div className="community-list">{shown.map(post=><article className="community-card" key={post.id}>
        <div className="community-card-meta"><span>{postTypeNames[post.post_type]}</span><time dateTime={post.created_at}>{formatDate(post.created_at)}</time></div>
        <h2>{post.title}</h2><p>{post.body}</p>
        {view==='mine'&&<div className="community-card-actions">
          <small>Статус: {({draft:'Черновик',pending:'На проверке',published:'Опубликовано',rejected:'Отклонено',archived:'Скрыто'} as Record<string,string>)[post.status]}</small>
          {(post.status==='draft'||post.status==='rejected')&&<button disabled={busy} onClick={()=>editDraft(post)}>Изменить</button>}
          {(post.status==='draft'||post.status==='rejected')&&<button disabled={busy}
            onClick={()=>void doAction(()=>submitCommunityPost(supabase,post.id,userId!))}>Отправить на проверку</button>}
          {post.post_type!=='news'&&post.status!=='archived'&&<button disabled={busy}
            onClick={()=>{
              if(window.confirm('Скрыть публикацию? Она исчезнет из городской ленты вместе с комментариями. Вернуть её самостоятельно нельзя.'))
                void doAction(()=>archiveCommunityPost(supabase,post.id),()=>{
                  setFeedback('Публикация скрыта из городской ленты.');
                });
            }}>Скрыть публикацию</button>}
        </div>}
        {view==='moderate'&&<div className="community-card-actions">
          {mayModerateCommunityMaterial(userId,post.author_id)?<>
            <button disabled={busy} onClick={()=>void doAction(()=>reviewCommunityPost(supabase,post.id,true))}>Одобрить</button>
            <button disabled={busy} onClick={()=>void doAction(()=>reviewCommunityPost(supabase,post.id,false))}>Отклонить</button>
          </>:<small>Собственную публикацию должен проверить другой редактор.</small>}
        </div>}
        {view==='feed'&&<section className="community-comments">
          <button className="community-comment-toggle" aria-expanded={selectedPost===post.id}
            onClick={()=>{setSelectedPost(v=>v===post.id?null:post.id);setCommentBody('');}}>Комментарии</button>
          {selectedPost===post.id&&<>
            {commentsFor!==post.id?<p>Загружаем комментарии…</p>
              :comments.length===0?<p>Пока нет одобренных комментариев.</p>
              :<ul>{comments.map(c=><li key={c.id}><p>{c.body}</p><small>{formatDate(c.created_at)}</small></li>)}</ul>}
            {userId?<form onSubmit={event=>{event.preventDefault();const text=commentBody;
              void doAction(()=>sendCommunityComment(supabase,post.id,text),()=>{
                setCommentBody('');setFeedback('Комментарий отправлен на модерацию.');
              });}}>
              <label htmlFor={'comment-'+post.id}>Написать комментарий</label>
              <textarea id={'comment-'+post.id} rows={2} minLength={2} maxLength={2000}
                value={commentBody} onChange={e=>setCommentBody(e.target.value)}/>
              <button disabled={busy||commentBody.trim().length<2}>Отправить на проверку</button>
            </form>:<button onClick={openLogin}>Войти, чтобы ответить</button>}
          </>}
        </section>}
      </article>)}</div>)}
    {view==='comments'&&<div className="community-list">
      {loading?<p>Загружаем комментарии…</p>:pendingComments.length===0?<div className="community-empty">Нет комментариев на проверке.</div>:
        pendingComments.map(comment=><article className="community-card" key={comment.id}>
          <div className="community-comment-context" aria-label="Публикация, к которой относится комментарий">
            <small>{postTypeNames[comment.community_posts.post_type]} · {comment.community_posts.city}</small>
            <h3>{comment.community_posts.title}</h3>
            <p>{comment.community_posts.body}</p>
          </div>
          <h2>Комментарий жителя</h2><p>{comment.body}</p>
          <div className="community-card-actions">
            {mayModerateCommunityMaterial(userId,comment.author_id)?<>
              <button disabled={busy} onClick={()=>void doAction(()=>reviewCommunityComment(supabase,comment.id,true))}>Одобрить</button>
              <button disabled={busy} onClick={()=>void doAction(()=>reviewCommunityComment(supabase,comment.id,false))}>Отклонить</button>
            </>:<small>Собственный комментарий должен проверить другой редактор.</small>}
          </div>
        </article>)}
    </div>}
  </section>;
}
