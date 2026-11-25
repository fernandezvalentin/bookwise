/**
 * Reads the emails Mailpit caught, through its HTTP API. Tests search by
 * recipient (each test uses a unique address) instead of emptying the inbox,
 * so they don't wipe the emails of local development.
 */

const API = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';

export interface CaughtEmail {
  subject: string;
  to: string[];
}

export async function emailsTo(address: string): Promise<CaughtEmail[]> {
  const query = encodeURIComponent(`to:"${address}"`);
  const res = await fetch(`${API}/api/v1/search?query=${query}&limit=50`);
  if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`);
  const body = (await res.json()) as {
    messages: { Subject: string; To: { Address: string }[] }[];
  };
  return body.messages.map((m) => ({
    subject: m.Subject,
    to: m.To.map((t) => t.Address),
  }));
}

/** Polls until `address` has received `count` emails whose subject contains `subject`. */
export async function waitForEmails(
  address: string,
  subject: string,
  count = 1,
  timeoutMs = 15_000,
): Promise<CaughtEmail[]> {
  const deadline = Date.now() + timeoutMs;
  let found: CaughtEmail[] = [];
  while (Date.now() < deadline) {
    found = (await emailsTo(address)).filter((e) =>
      e.subject.includes(subject),
    );
    if (found.length >= count) return found;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `Expected ${count} "${subject}" email(s) to ${address}, found ${found.length}`,
  );
}

/** Waits a bit and returns how many matching emails arrived (to assert "none"). */
export async function countEmailsAfterWait(
  address: string,
  subject: string,
  waitMs = 2000,
): Promise<number> {
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  return (await emailsTo(address)).filter((e) => e.subject.includes(subject))
    .length;
}
