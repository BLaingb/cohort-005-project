import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { MAX_NOTE_LENGTH } from "./notes";
import { getNote, listNotesForStudent, saveNote } from "./notes.server";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);

function minutesAfter(minutes: number) {
  return new Date(NOW.getTime() + minutes * 60_000);
}

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonIds: number[];

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();

  lessonIds = [1, 2, 3].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

describe("saving a Note", () => {
  it("creates the Note with the body trimmed", () => {
    const result = saveNote(db, base.user.id, lessonIds[0], "  # not a heading *  ", NOW);

    expect(result.ok).toBe(true);
    expect(getNote(db, base.user.id, lessonIds[0])).toMatchObject({
      body: "# not a heading *",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
  });

  it("replaces the body and moves the last-edited time on when saved again", () => {
    saveNote(db, base.user.id, lessonIds[0], "First thoughts", NOW);
    saveNote(db, base.user.id, lessonIds[0], "Second thoughts", minutesAfter(30));

    expect(getNote(db, base.user.id, lessonIds[0])).toMatchObject({
      body: "Second thoughts",
      createdAt: NOW.toISOString(),
      updatedAt: minutesAfter(30).toISOString(),
    });
  });

  it("never leaves a Student with two Notes on one Lesson", () => {
    saveNote(db, base.user.id, lessonIds[0], "One", NOW);
    saveNote(db, base.user.id, lessonIds[0], "Two", minutesAfter(1));

    expect(listNotesForStudent(db, base.user.id)).toHaveLength(1);
    expect(() =>
      db
        .insert(schema.notes)
        .values({ userId: base.user.id, lessonId: lessonIds[0], body: "Three" })
        .run()
    ).toThrow();
  });

  it(`accepts a Note of exactly ${MAX_NOTE_LENGTH} characters`, () => {
    const body = "a".repeat(MAX_NOTE_LENGTH);

    expect(saveNote(db, base.user.id, lessonIds[0], body, NOW).ok).toBe(true);
    expect(getNote(db, base.user.id, lessonIds[0])?.body).toBe(body);
  });

  it(`refuses a Note over ${MAX_NOTE_LENGTH} characters with a message`, () => {
    const result = saveNote(
      db,
      base.user.id,
      lessonIds[0],
      "a".repeat(MAX_NOTE_LENGTH + 1),
      NOW
    );

    expect(result).toEqual({
      ok: false,
      error: "A note can be at most 2,000 characters.",
    });
    expect(getNote(db, base.user.id, lessonIds[0])).toBeUndefined();
  });

  it("refuses an empty Note and keeps the one already saved", () => {
    saveNote(db, base.user.id, lessonIds[0], "Keep me", NOW);

    expect(saveNote(db, base.user.id, lessonIds[0], "   ", minutesAfter(1)).ok).toBe(false);
    expect(getNote(db, base.user.id, lessonIds[0])?.body).toBe("Keep me");
  });
});

describe("listing a Student's Notes", () => {
  it("lists only that Student's Notes, newest edit first, with Lesson and Course", () => {
    const other = db
      .insert(schema.users)
      .values({ name: "Other", email: "other@example.com", role: UserRole.Student })
      .returning()
      .get();

    saveNote(db, base.user.id, lessonIds[0], "On lesson 1", minutesAfter(0));
    saveNote(db, base.user.id, lessonIds[1], "On lesson 2", minutesAfter(5));
    saveNote(db, other.id, lessonIds[2], "Someone else's", minutesAfter(10));
    saveNote(db, base.user.id, lessonIds[0], "On lesson 1, edited", minutesAfter(15));

    expect(listNotesForStudent(db, base.user.id)).toEqual([
      expect.objectContaining({
        body: "On lesson 1, edited",
        lessonId: lessonIds[0],
        lessonTitle: "Lesson 1",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      }),
      expect.objectContaining({
        body: "On lesson 2",
        lessonId: lessonIds[1],
        lessonTitle: "Lesson 2",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      }),
    ]);
  });
});
