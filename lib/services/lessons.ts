import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type {
  Lesson,
  LessonBlock,
  LessonDidactics,
  LessonWithDetails,
} from "@/types/lesson";

const LESSON_WITH_DETAILS_SELECT = "*, lesson_didactics(*), lesson_blocks(*)";

async function getServerClient() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

// PostgREST embeds a to-one relationship (lesson_didactics has a unique FK
// back to lessons) as an object, but returns an array if that uniqueness
// isn't picked up — normalize defensively instead of trusting either shape.
function normalizeLesson(row: Lesson & {
  lesson_didactics: LessonDidactics | LessonDidactics[] | null;
  lesson_blocks: LessonBlock[] | null;
}): LessonWithDetails {
  const { lesson_didactics, lesson_blocks, ...lesson } = row;

  return {
    ...lesson,
    lesson_didactics: Array.isArray(lesson_didactics)
      ? (lesson_didactics[0] ?? null)
      : lesson_didactics,
    lesson_blocks: lesson_blocks ?? [],
  };
}

export async function getUserLessons(
  userId: string,
): Promise<LessonWithDetails[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("lessons")
    .select(LESSON_WITH_DETAILS_SELECT)
    .eq("author_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Kon lessen niet ophalen: ${error.message}`);
  }

  return (data ?? []).map(normalizeLesson);
}

export async function getLessonById(
  lessonId: string,
): Promise<LessonWithDetails | null> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("lessons")
    .select(LESSON_WITH_DETAILS_SELECT)
    .eq("id", lessonId)
    .maybeSingle();

  if (error) {
    throw new Error(`Kon les niet ophalen: ${error.message}`);
  }

  return data ? normalizeLesson(data) : null;
}

export async function getPublicLessons(): Promise<LessonWithDetails[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("lessons")
    .select(LESSON_WITH_DETAILS_SELECT)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Kon openbare lessen niet ophalen: ${error.message}`);
  }

  return (data ?? []).map(normalizeLesson);
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const supabase = await getServerClient();

  // RLS ("Eigenaren kunnen eigen lessen beheren") is the actual
  // enforcement here — a lesson the caller doesn't own simply won't match
  // and nothing is deleted.
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);

  if (error) {
    throw new Error(`Kon les niet verwijderen: ${error.message}`);
  }
}
