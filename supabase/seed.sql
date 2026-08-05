-- =====================================================================
-- UniVault — Seed Data (universities + fields)
-- Run AFTER schema.sql
-- =====================================================================

-- Seed the 5 universities
insert into universities (name, slug, type, description) values
('University College of Applied Sciences (UCAS)', 'ucas', 'Public University College — Applied & Technical Sciences', 'Gaza-based technical college, 40+ applied and technical majors.'),
('Islamic University of Gaza', 'iug', 'Public University', 'Oldest university in the Gaza Strip, established 1978.'),
('Al-Aqsa University', 'alaqsa', 'Public University', 'Largest public university in Palestine, campuses in Gaza City and Khan Younis.'),
('Al-Azhar University – Gaza', 'azhar-gaza', 'Public University (non-profit)', 'Established 1991 as a national Palestinian university.'),
('University of Palestine', 'up', 'Private University', 'Private university founded 2005, based in Al-Zahra, Gaza.');

-- Seed the initial fields. Run inside a DO block so we can look up the
-- university ids by slug instead of hard-coding UUIDs.
do $$
declare
  v_ucas uuid;
  v_iug uuid;
  v_alaqsa uuid;
  v_azhar uuid;
  v_up uuid;
begin
  select id into v_ucas  from universities where slug = 'ucas';
  select id into v_iug   from universities where slug = 'iug';
  select id into v_alaqsa from universities where slug = 'alaqsa';
  select id into v_azhar from universities where slug = 'azhar-gaza';
  select id into v_up    from universities where slug = 'up';

  insert into fields (university_id, name, slug, theme, description) values
  (v_ucas,  'Cybersecurity & Information Security Engineering', 'cybersecurity',        'cyber',   'The special one. Dark theme, hacker terminal aesthetic.'),
  (v_ucas,  'Computer Engineering',                            'computer-engineering', 'default', ''),
  (v_ucas,  'Multimedia Technology',                           'multimedia',           'default', ''),
  (v_iug,   'Computer Science',                                'computer-science',     'default', ''),
  (v_iug,   'Business Administration',                         'business',             'default', ''),
  (v_alaqsa,'Information Technology',                          'it',                   'default', ''),
  (v_azhar, 'Software Engineering',                            'software-engineering', 'default', ''),
  (v_up,    'Computer Engineering',                            'computer-engineering', 'default', '');
end $$;

-- Grant the popularity view to anon/authenticated so public dashboards
-- can read purchase counts directly from the frontend.
grant select on service_popularity to anon, authenticated;
