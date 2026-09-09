-- The duplicate detector is a trigger implementation detail, not a Data API RPC.
begin;
revoke all on function public.flag_possible_duplicate() from public, anon, authenticated;
commit;
