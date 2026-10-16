/* global window */
export const CLASSIFIED_PHOTO_LIMIT=10;
const state=window.galleryTest={loads:0,signs:0,fail:false,empty:!!window.galleryInitialEmpty};
export async function listClassifiedPhotos(){
  state.loads++;
  if(state.fail)throw Error('Synthetic signing outage');
  return state.empty?[]:[0,1].map(slot=>({id:String(slot),slot,listing_id:'listing',format:'webp',object_path:`listing/${slot}.webp`}));
}
export async function signedClassifiedPhotos(_client,rows){
  const generation=++state.signs;
  return rows.map(row=>({...row,url:`/test-images/${generation}/${row.id}.svg`}));
}
export async function uploadClassifiedPhotos(){throw Error('Upload is outside this fixture');}
export async function deleteClassifiedPhoto(){throw Error('Delete is outside this fixture');}
