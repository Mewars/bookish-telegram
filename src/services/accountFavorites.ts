import type { SupabaseClient } from '@supabase/supabase-js';
export interface AccountFavoritesRepository {
  list(userId: string): Promise<string[]>;
  add(userId: string, itemIds: string[]): Promise<void>;
  remove(userId: string, itemId: string): Promise<void>;
}
export function createAccountFavoritesRepository(client: SupabaseClient): AccountFavoritesRepository {
  const checkUser = async (userId: string) => {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || session?.user.id !== userId) throw new Error('Сессия пользователя изменилась.');
  };
  return {
    async list(userId) {
      await checkUser(userId);
      const { data, error } = await client.from('user_favorites').select('item_id').eq('user_id', userId);
      if (error) throw error;
      return (data ?? []).map(row => row.item_id as string);
    },
    async add(userId, itemIds) {
      if (!itemIds.length) return;
      await checkUser(userId);
      const { error } = await client.from('user_favorites').upsert([...new Set(itemIds)].map(item_id => ({ user_id: userId, item_id })), { onConflict: 'user_id,item_id', ignoreDuplicates: true });
      if (error) throw error;
    },
    async remove(userId, itemId) {
      await checkUser(userId);
      const { error } = await client.from('user_favorites').delete().eq('user_id', userId).eq('item_id', itemId);
      if (error) throw error;
    },
  };
}
export async function mergeGuestFavorites(userId: string, localIds: readonly string[], repository: AccountFavoritesRepository): Promise<string[]> {
  const remote = await repository.list(userId);
  const missing = [...new Set(localIds)].filter(id => !remote.includes(id));
  if (missing.length) await repository.add(userId, missing);
  return [...new Set(await repository.list(userId))];
}
