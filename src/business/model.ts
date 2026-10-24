import type {ApplicationDraft} from '../organizations/model';

export const BUSINESS_MESSAGES_URL = 'https://vk.me/ryadomcity';
export const DESIGN_REQUEST_NOTE = 'Запрос помощи с оформлением новой карточки. Стоимость и состав работ не согласованы.\n';

export function businessApplicationHash(city:string, design=false):string {
 const params=new URLSearchParams({city});
 if(design)params.set('service','design');
 return '#/add-organization?'+params.toString();
}
export function businessHash(city:string,organizationId?:string):string {
 const params=new URLSearchParams({city});
 if(organizationId)params.set('organization',organizationId);
 return '#/business?'+params.toString();
}
// This is an applicant's request, never proof of payment, ownership or a role.
// Use the existing private source note; no schema or access changes are needed.
export function withDesignRequest(draft:ApplicationDraft,requested:boolean):ApplicationDraft {
 return requested?{...draft,source_note:DESIGN_REQUEST_NOTE+draft.source_note}:draft;
}
