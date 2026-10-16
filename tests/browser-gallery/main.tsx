import { createRoot } from 'react-dom/client';
import { ClassifiedPhotoGallery } from '../../src/classifieds/ClassifiedPhotoGallery';
const listing={id:'listing',city:'Енисейск',author_id:'synthetic-author',title:'Тестовая фотография',
  description:'Synthetic browser fixture',deal_type:'sell' as const,category:'Тест',district:'',
  price_rub:null,status:'draft' as const,created_at:'',updated_at:''};
const root=createRoot(document.getElementById('root')!);
root.render(<ClassifiedPhotoGallery listing={listing} editable={true}/>);
// Explicitly unmount the real component to verify effect cleanup.
document.addEventListener('gallery-test-unmount',()=>root.unmount());
