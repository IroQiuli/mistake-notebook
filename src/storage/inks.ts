import { db } from './db';
import { newId } from '../lib/id';
import type { Ink, InkOwner, Stroke } from '../domain/types';

export async function getInk(id: string): Promise<Ink | undefined> {
  return db.inks.get(id);
}

export async function latestInk(ownerType: InkOwner, ownerId: string): Promise<Ink | undefined> {
  const list = await db.inks.where('ownerId').equals(ownerId).toArray();
  return list
    .filter((i) => i.ownerType === ownerType)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export async function listInks(ownerType: InkOwner, ownerId: string): Promise<Ink[]> {
  const list = await db.inks.where('ownerId').equals(ownerId).toArray();
  return list.filter((i) => i.ownerType === ownerType).sort((a, b) => b.createdAt - a.createdAt);
}

export interface SaveInkArgs {
  id?: string;
  ownerType: InkOwner;
  ownerId: string;
  strokes: Stroke[];
  aspect: number;
}

export async function saveInk(args: SaveInkArgs): Promise<string> {
  const now = Date.now();
  if (args.id) {
    await db.inks.update(args.id, {
      strokes: args.strokes,
      aspect: args.aspect,
      updatedAt: now,
    });
    return args.id;
  }
  const id = newId();
  const ink: Ink = {
    id,
    ownerType: args.ownerType,
    ownerId: args.ownerId,
    aspect: args.aspect,
    strokes: args.strokes,
    createdAt: now,
    updatedAt: now,
  };
  await db.inks.add(ink);
  return id;
}

export async function deleteInk(id: string): Promise<void> {
  await db.inks.delete(id);
}
