create policy "approved view approved profiles"
on public.profiles for select to authenticated
using (
  status = 'approved'
  and public.is_approved(auth.uid())
);