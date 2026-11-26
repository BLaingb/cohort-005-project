import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "~/db/schema";
import { courses, lessons, modules, notes } from "~/db/schema";
import { noteBodySchema } from "~/lib/notes";

// ─── Notes ───
// A Student's own writing about a Lesson, private to the Student who wrote it.
// One per Student per Lesson, enforced by the unique index on
// (user_id, lesson_id). Plain text, never rendered as Markdown. See GLOSSARY.md.
//
// Only the owning Student's Lesson page and Saved page may read Note bodies.
// Every function is keyed on the Student, so no caller can list someone
// else's Notes through this module.
//
// Every function takes the database first, so tests can hand in an in-memory
// one. Content access is the caller's job: the Lesson action checks it before
// calling in.

export type Db = BetterSQLite3Database<typeof schema>;

type Note = typeof notes.$inferSelect;

export type SaveNoteResult = { ok: true; note: Note } | { ok: false; error: string };

export function getNote(db: Db, userId: number, lessonId: number) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.lessonId, lessonId)))
    .get();
}

/**
 * Creates the Student's Note on the Lesson, or replaces the body of the one
 * they have. Saving moves the "last edited" time (`updatedAt`) on and leaves
 * `createdAt` alone. An empty or over-long body is refused, not truncated.
 */
export function saveNote(
  db: Db,
  userId: number,
  lessonId: number,
  body: string,
  now: Date
): SaveNoteResult {
  const parsed = noteBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const at = now.toISOString();
  const note = db
    .insert(notes)
    .values({ userId, lessonId, body: parsed.data, createdAt: at, updatedAt: at })
    .onConflictDoUpdate({
      target: [notes.userId, notes.lessonId],
      set: { body: parsed.data, updatedAt: at },
    })
    .returning()
    .get();

  return { ok: true, note };
}

/** The Student's Notes, newest edit first, each with its Lesson and Course. */
export function listNotesForStudent(db: Db, userId: number) {
  return db
    .select({
      id: notes.id,
      body: notes.body,
      updatedAt: notes.updatedAt,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(notes)
    .innerJoin(lessons, eq(notes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updatedAt), desc(notes.id))
    .all();
}
