-- =====================================================================
-- UniVault — Make Yourself Admin
-- Run AFTER you have created your own account on the live site
-- (sign up normally, then run this replacing YOUR_USERNAME).
--
-- The admin panel on the frontend uses a separate password (ADMIN_PASSWORD_HASH
-- in the backend env) but the is_admin flag controls whether the *dashboard*
-- nav link shows and whether your profile behaves as the platform owner.
-- =====================================================================

update profiles
set is_admin = true
where username = 'YOUR_USERNAME';

-- Verify:
select username, is_admin, created_at from profiles where is_admin = true;
