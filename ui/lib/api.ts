import type { Action, RunJournal, Scenario, SessionRecord, User } from '../../sim-core/types';

export interface Bootstrap { user: User; users: User[]; scenarios: Scenario[]; sessions: SessionRecord[]; draft: RunJournal | null; engine_version: string }
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function apiRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000) }); }
  catch { throw new ApiError(0, 'The local service is unavailable. Your current actions remain in the browser journal.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.error ?? `Local service returned ${response.status}.`);
  return data as T;
}
export const api = {
  bootstrap: () => apiRequest<Bootstrap>('/bootstrap'),
  me: () => apiRequest<User>('/auth/me'),
  login: (id: string, password: string) => apiRequest<User>('/auth/login', 'POST', { id, password }),
  start: (scenario: Scenario, mode: string) => apiRequest<RunJournal>('/sessions', 'POST', { scenario, mode }),
  checkpoint: (journal: RunJournal) => apiRequest<{ tick: number }>('/sessions/' + journal.id + '/checkpoint', 'PUT', { actions: journal.actions, tick: journal.tick }),
  finish: (journal: RunJournal) => apiRequest<SessionRecord>('/sessions/' + journal.id + '/finish', 'POST', { actions: journal.actions, tick: journal.tick }),
  adaptiveProfile: () => apiRequest<any>('/adaptive/profile'),
  recommend: (seed?: number) => apiRequest<any>('/adaptive/recommend', 'POST', { seed }),
};
