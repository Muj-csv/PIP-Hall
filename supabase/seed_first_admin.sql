-- Run once in the Supabase SQL editor AFTER you have signed in to the app with Google at least once.
-- Replace the email with the Google account you signed in with.
update public.user_roles
   set role = 'admin'
 where user_id = (select id from auth.users where email = 'YOUR_GOOGLE_EMAIL');

-- Check: should return one row with role = admin
select u.email, r.role from public.user_roles r join auth.users u on u.id = r.user_id where r.role = 'admin';
