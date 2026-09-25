-- activity_likes_sync_count is a SECURITY DEFINER trigger function — the
-- trigger mechanism invokes it regardless of EXECUTE grants, but leaving
-- EXECUTE granted to anon/authenticated exposes it as a directly callable
-- RPC (/rest/v1/rpc/activity_likes_sync_count) that could manipulate
-- activiteiten.like_count outside the insert/delete-on-activity_likes path
-- it's meant to guard. Revoking direct EXECUTE closes that without
-- affecting the trigger itself.
revoke execute on function public.activity_likes_sync_count() from public, anon, authenticated;
