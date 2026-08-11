-- The existing "Iedereen kan openbare lessen lezen"-style policies are all
-- scoped `to authenticated`, so a logged-out visitor opening a shared link
-- (RLS evaluates as the `anon` role) gets zero rows even though the lesson
-- is is_public = true. Add matching `to anon` SELECT policies so public
-- share links actually work for anonymous visitors.

create policy "Anonieme bezoekers lezen openbare lessen" on public.lessons
  for select
  to anon
  using (is_public = true);

create policy "Anonieme bezoekers lezen didactiek van openbare les" on public.lesson_didactics
  for select
  to anon
  using (
    exists (
      select 1 from public.lessons
      where id = lesson_didactics.lesson_id and is_public = true
    )
  );

create policy "Anonieme bezoekers lezen blokken van openbare les" on public.lesson_blocks
  for select
  to anon
  using (
    exists (
      select 1 from public.lessons
      where id = lesson_blocks.lesson_id and is_public = true
    )
  );

create policy "Anonieme bezoekers lezen tags van openbare les" on public.lesson_tags
  for select
  to anon
  using (
    exists (
      select 1 from public.lessons
      where id = lesson_tags.lesson_id and is_public = true
    )
  );
