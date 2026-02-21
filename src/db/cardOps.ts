import { getDB } from './geoDB';
import type { GeoCard, Focus } from '../types/geo';

/** Get a single card by id. Returns undefined if not found. */
export async function getCard(id: string): Promise<GeoCard | undefined> {
  const db = await getDB();
  return db.get('geo_cards', id);
}

/** Get all cards for a given focus. */
export async function getCardsByFocus(focus: Focus): Promise<GeoCard[]> {
  const db = await getDB();
  return db.getAllFromIndex('geo_cards', 'by_focus', focus);
}

/**
 * Get due cards for a given focus (nextReview <= now).
 * Sorted by nextReview ASC (most overdue first).
 */
export async function getDueCardsByFocus(
  focus: Focus,
  now: number = Date.now(),
): Promise<GeoCard[]> {
  const db = await getDB();
  // Fetch all for focus, then filter by due date in JS
  // (IDBKeyRange on compound index is verbose; this is simpler and fast enough)
  const all = await db.getAllFromIndex('geo_cards', 'by_focus', focus);
  return all.filter((c) => c.nextReview <= now).sort((a, b) => a.nextReview - b.nextReview);
}

/**
 * Get due cards across ALL focuses (for Review All mode).
 * Sorted by nextReview ASC.
 */
export async function getAllDueCards(now: number = Date.now()): Promise<GeoCard[]> {
  const db = await getDB();
  const all = await db.getAll('geo_cards');
  return all.filter((c) => c.nextReview <= now).sort((a, b) => a.nextReview - b.nextReview);
}

/** Upsert (create or update) a card. */
export async function saveCard(card: GeoCard): Promise<void> {
  const db = await getDB();
  await db.put('geo_cards', card);
}

/** Upsert multiple cards in a single transaction. */
export async function saveCards(cards: GeoCard[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('geo_cards', 'readwrite');
  await Promise.all([...cards.map((c) => tx.store.put(c)), tx.done]);
}

/** Delete a card by id. */
export async function deleteCard(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('geo_cards', id);
}

/** Delete all cards for a focus (reset progress). */
export async function deleteCardsByFocus(focus: Focus): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('geo_cards', 'readwrite');
  const index = tx.store.index('by_focus');
  let cursor = await index.openCursor(focus);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

/** Delete all cards across all focuses. */
export async function deleteAllCards(): Promise<void> {
  const db = await getDB();
  await db.clear('geo_cards');
}

/** Return ids of existing cards for a focus (used for bootstrapping). */
export async function getExistingCardIds(focus: Focus): Promise<Set<string>> {
  const db = await getDB();
  const all = await db.getAllFromIndex('geo_cards', 'by_focus', focus);
  return new Set(all.map((c) => c.id));
}
