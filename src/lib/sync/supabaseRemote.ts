import type { SupabaseClient } from '@supabase/supabase-js';
import type { Remote, RemoteRow, SyncTable } from './engine';

/** The columns that identify a row on the server: always the signed-in user plus the row's own key. */
const CONFLICT: Record<SyncTable, string> = {
  food_log: 'user_id,uid',
  recipes: 'user_id,uid',
  weight_log: 'user_id,date',
  settings: 'user_id,key',
};

/**
 * The sync server is a Supabase project (Postgres behind a REST API). Row-level security on the server limits
 * every request to the signed-in user's own rows; `user_id` is sent explicitly so the upsert can match them.
 */
export function supabaseRemote(client: SupabaseClient, userId: string): Remote {
  return {
    async pull(table, after, limit) {
      let query = client.from(table).select('*').order('server_ts', { ascending: true }).limit(limit);
      if (after) query = query.gte('server_ts', after);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as RemoteRow[];
    },
    async push(table, rows) {
      if (rows.length === 0) return;
      const { error } = await client.from(table).upsert(
        rows.map((r) => ({ ...r, user_id: userId })),
        { onConflict: CONFLICT[table] },
      );
      if (error) throw new Error(error.message);
    },
  };
}
