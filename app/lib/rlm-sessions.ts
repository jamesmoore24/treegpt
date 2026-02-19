import { RLMEvent } from "@/types/rlm";

type Session = {
  events: RLMEvent[];
  waiters: Array<() => void>;
  closed: boolean;
};

// Global session map — shared across requests on the same Node.js process (EC2/PM2)
export const rlmSessions = new Map<string, Session>();

export function createSession(sessionId: string): Session {
  const session: Session = { events: [], waiters: [], closed: false };
  rlmSessions.set(sessionId, session);
  return session;
}

export function pushEvent(sessionId: string, event: RLMEvent) {
  const session = rlmSessions.get(sessionId);
  if (!session) return;
  session.events.push(event);
  // Wake all waiters
  const waiters = session.waiters.splice(0);
  waiters.forEach((fn) => fn());
}

export function closeSession(sessionId: string) {
  const session = rlmSessions.get(sessionId);
  if (!session) return;
  session.closed = true;
  const waiters = session.waiters.splice(0);
  waiters.forEach((fn) => fn());
  // Clean up after 60s to avoid memory leaks
  setTimeout(() => rlmSessions.delete(sessionId), 60_000);
}

/**
 * Returns the event at `index`, waiting if it hasn't arrived yet.
 * Returns null if the session is closed and no event at `index` exists.
 */
export async function waitForEvent(
  sessionId: string,
  index: number
): Promise<RLMEvent | null> {
  const session = rlmSessions.get(sessionId);
  if (!session) return null;

  if (index < session.events.length) {
    return session.events[index];
  }

  if (session.closed) return null;

  // Wait for a new event or session close
  await new Promise<void>((resolve) => {
    session.waiters.push(resolve);
  });

  const s = rlmSessions.get(sessionId);
  if (!s) return null;
  if (index < s.events.length) return s.events[index];
  return null; // session closed, no event
}
