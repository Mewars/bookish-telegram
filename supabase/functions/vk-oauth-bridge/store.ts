export type RecordKind = 'attempt' | 'code' | 'bearer';
export interface BridgeStore {
  put(kind: RecordKind, key: string, payload: string, ttl: number): Promise<void>;
  get(kind: RecordKind, key: string): Promise<string | null>;
  take(kind: RecordKind, key: string): Promise<string | null>;
  limit(scope: 'authorize' | 'exchange'): Promise<boolean>;
}
export function postgresStore(origin: string, serviceKey: string, request: typeof fetch = fetch): BridgeStore {
  async function rpc(name: string, args: unknown) {
    const response = await request(origin+'/rest/v1/rpc/'+name, {
      method:'POST', headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},
      body:JSON.stringify(args), redirect:'error', signal:AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error('Bridge storage unavailable');
    return await response.json();
  }
  const record = (op: string, kind: RecordKind, key: string, payload?: string, ttl?: number) => rpc('vk_bridge_record', {
    op,record_kind:kind,record_digest:key,encrypted_payload:payload??null,ttl_seconds:ttl??0,
  });
  return {
    async put(kind,key,payload,ttl) { await record('put',kind,key,payload,ttl); },
    async get(kind,key) { const result=await record('get',kind,key); if (result!==null && typeof result!=='string') throw new Error('Invalid storage response'); return result as string|null; },
    async take(kind,key) { const result=await record('take',kind,key); if (result!==null && typeof result!=='string') throw new Error('Invalid storage response'); return result as string|null; },
    async limit(scope) { return await rpc('vk_bridge_rate_limit',{rate_scope:scope}) === true; },
  };
}
