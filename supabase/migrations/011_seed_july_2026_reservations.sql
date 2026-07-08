-- Seed July 2026 reservations from Nexudus export (file 2, most updated)
-- All reservations attributed to caroline@bizhaus.com / BizHaus for beta display purposes

-- Step 1: Clear all existing July 2026 reservations
DELETE FROM reservations
WHERE start_time >= '2026-07-01 00:00:00+00'
  AND start_time <  '2026-08-01 00:00:00+00';

-- Step 2: Insert all 83 reservations
INSERT INTO reservations (room_id, user_id, company_id, title, start_time, end_time)
SELECT
  r.id,
  p.id,
  c.id,
  v.title,
  v.start_time::timestamptz,
  v.end_time::timestamptz
FROM (VALUES
  -- July 1
  ('Board Room w/ Apple TV', 'Costa Mesa',     'Mint',                              '2026-07-01 09:00:00-07', '2026-07-01 10:00:00-07'),
  ('Board Room w/ Apple TV', 'Costa Mesa',     'Mint',                              '2026-07-01 10:00:00-07', '2026-07-01 11:00:00-07'),
  ('Board Room w/ Apple TV', 'Costa Mesa',     'Mint',                              '2026-07-01 11:00:00-07', '2026-07-01 12:00:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'JB',                                '2026-07-01 09:30:00-07', '2026-07-01 10:30:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'CDW',                               '2026-07-01 11:00:00-07', '2026-07-01 12:00:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'Goosehead',                         '2026-07-01 12:00:00-07', '2026-07-01 13:00:00-07'),
  ('Library East',           'Costa Mesa',     'Brandon Tran & Diana Hsueh',        '2026-07-01 10:00:00-07', '2026-07-01 11:00:00-07'),
  ('Library East',           'Costa Mesa',     'Mint RE Meeting',                   '2026-07-01 11:30:00-07', '2026-07-01 12:30:00-07'),
  ('Library West',           'Costa Mesa',     'Christine - Intelitics',            '2026-07-01 09:00:00-07', '2026-07-01 10:00:00-07'),
  ('Library West',           'Costa Mesa',     'Intelitics',                        '2026-07-01 10:30:00-07', '2026-07-01 11:00:00-07'),
  ('Library West',           'Costa Mesa',     'Aloupas Law, P.C.',                 '2026-07-01 13:30:00-07', '2026-07-01 15:30:00-07'),
  ('Large Conference',       'El Segundo',     'Call',                              '2026-07-01 09:00:00-07', '2026-07-01 10:00:00-07'),
  ('Large Conference',       'El Segundo',     'Screenvision LA',                   '2026-07-01 11:30:00-07', '2026-07-01 13:00:00-07'),
  ('Large Conference',       'El Segundo',     'Screenvision LA',                   '2026-07-01 13:00:00-07', '2026-07-01 14:00:00-07'),
  ('Medium Conference',      'El Segundo',     'Joy',                               '2026-07-01 12:45:00-07', '2026-07-01 13:45:00-07'),
  ('Small Meeting',          'El Segundo',     'manager meeting',                   '2026-07-01 13:30:00-07', '2026-07-01 14:00:00-07'),
  ('Small Meeting',          'El Segundo',     'manager meeting',                   '2026-07-01 14:00:00-07', '2026-07-01 15:00:00-07'),
  ('Library',                'El Segundo',     'Unmatched Ventures',                '2026-07-01 09:00:00-07', '2026-07-01 17:00:00-07'),
  ('Conference Room',        'Marina del Rey', 'Ryan Hashemi',                      '2026-07-01 09:00:00-07', '2026-07-01 17:00:00-07'),
  -- July 2
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-02 09:30:00-07', '2026-07-02 10:30:00-07'),
  ('Board Room w/ Apple TV', 'Costa Mesa',     'Mint',                              '2026-07-02 13:00:00-07', '2026-07-02 14:00:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'Ag meeting',                        '2026-07-02 10:30:00-07', '2026-07-02 11:30:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'Nick Caine',                        '2026-07-02 12:00:00-07', '2026-07-02 15:00:00-07'),
  ('Medium Conference',      'El Segundo',     'Teresa Giovannoli',                 '2026-07-02 11:00:00-07', '2026-07-02 12:00:00-07'),
  ('Conference Room',        'Marina del Rey', 'Ryan Hashemi',                      '2026-07-02 09:00:00-07', '2026-07-02 17:00:00-07'),
  -- July 3
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-03 09:30:00-07', '2026-07-03 10:30:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'Mint',                              '2026-07-03 09:00:00-07', '2026-07-03 10:00:00-07'),
  -- July 6
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-06 09:30:00-07', '2026-07-06 10:30:00-07'),
  ('Board Room w/ Apple TV', 'Costa Mesa',     'Intelitics',                        '2026-07-06 11:00:00-07', '2026-07-06 16:00:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'Mint',                              '2026-07-06 09:30:00-07', '2026-07-06 11:00:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'JB',                                '2026-07-06 11:00:00-07', '2026-07-06 12:00:00-07'),
  ('Small Meeting',          'El Segundo',     'Sean D',                            '2026-07-06 09:00:00-07', '2026-07-06 17:00:00-07'),
  -- July 7
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-07 09:30:00-07', '2026-07-07 10:30:00-07'),
  ('Board Room w/ Apple TV', 'Costa Mesa',     'Entrust Janitorial Staff Meeting',  '2026-07-07 17:20:00-07', '2026-07-07 18:20:00-07'),
  ('Large Conference',       'El Segundo',     'GoG Meeting',                       '2026-07-07 10:00:00-07', '2026-07-07 15:00:00-07'),
  ('Small Meeting',          'El Segundo',     'Sean D',                            '2026-07-07 09:00:00-07', '2026-07-07 17:00:00-07'),
  -- July 8
  ('Board Room w/ Apple TV', 'Costa Mesa',     'Intelitics',                        '2026-07-08 09:00:00-07', '2026-07-08 13:00:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'JB',                                '2026-07-08 09:30:00-07', '2026-07-08 10:30:00-07'),
  ('Conference Room',        'Marina del Rey', 'Clifford Helia',                    '2026-07-08 15:30:00-07', '2026-07-08 19:30:00-07'),
  -- July 9
  ('Servco w/ Apple TV',     'Costa Mesa',     'Goosehead',                         '2026-07-09 11:30:00-07', '2026-07-09 12:15:00-07'),
  -- July 10
  ('Board Room w/ Apple TV', 'Costa Mesa',     'Mint',                              '2026-07-10 09:00:00-07', '2026-07-10 10:00:00-07'),
  -- July 11
  ('Large Conference',       'El Segundo',     'Citizens Climate Lobby',            '2026-07-11 09:30:00-07', '2026-07-11 12:00:00-07'),
  -- July 13
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-13 09:30:00-07', '2026-07-13 10:30:00-07'),
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-13 11:00:00-07', '2026-07-13 12:00:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'Mint',                              '2026-07-13 09:30:00-07', '2026-07-13 11:00:00-07'),
  ('Library',                'El Segundo',     'Aperture',                          '2026-07-13 10:00:00-07', '2026-07-13 17:00:00-07'),
  -- July 14
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-14 09:30:00-07', '2026-07-14 10:30:00-07'),
  ('Board Room w/ Apple TV', 'Costa Mesa',     'Entrust Janitorial Staff Meeting',  '2026-07-14 17:20:00-07', '2026-07-14 18:20:00-07'),
  ('Library',                'El Segundo',     'Aperture',                          '2026-07-14 08:30:00-07', '2026-07-14 13:00:00-07'),
  -- July 15
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-15 09:30:00-07', '2026-07-15 10:30:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'Mint',                              '2026-07-15 09:00:00-07', '2026-07-15 10:00:00-07'),
  -- July 16
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-16 09:30:00-07', '2026-07-16 10:30:00-07'),
  ('Large Conference',       'El Segundo',     'Integral Forensics Work Space',     '2026-07-16 08:30:00-07', '2026-07-16 13:30:00-07'),
  ('Library',                'El Segundo',     'Integral Forensics Work Space',     '2026-07-16 09:00:00-07', '2026-07-16 17:00:00-07'),
  ('Medium Conference',      'El Segundo',     'Angel Santos Trejo Direct Exam',    '2026-07-16 09:00:00-07', '2026-07-16 17:00:00-07'),
  -- July 17
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-17 09:30:00-07', '2026-07-17 10:30:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'Mint',                              '2026-07-17 09:00:00-07', '2026-07-17 10:00:00-07'),
  ('Library',                'El Segundo',     'Integral Forensics Work Space',     '2026-07-17 08:00:00-07', '2026-07-17 12:30:00-07'),
  -- July 20
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-20 09:30:00-07', '2026-07-20 10:30:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'Mint',                              '2026-07-20 09:30:00-07', '2026-07-20 11:00:00-07'),
  -- July 21
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-21 09:30:00-07', '2026-07-21 10:30:00-07'),
  ('Board Room w/ Apple TV', 'Costa Mesa',     'MESA | Amin',                       '2026-07-21 13:30:00-07', '2026-07-21 16:30:00-07'),
  ('Board Room w/ Apple TV', 'Costa Mesa',     'Entrust Janitorial Staff Meeting',  '2026-07-21 17:20:00-07', '2026-07-21 18:20:00-07'),
  -- July 22
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-22 09:30:00-07', '2026-07-22 10:30:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'Mint',                              '2026-07-22 09:00:00-07', '2026-07-22 10:00:00-07'),
  -- July 23
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-23 09:30:00-07', '2026-07-23 10:30:00-07'),
  ('Large Conference',       'El Segundo',     'Santos Trejo Cross Exam',           '2026-07-23 09:00:00-07', '2026-07-23 17:00:00-07'),
  -- July 24
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-24 09:30:00-07', '2026-07-24 10:30:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'Mint',                              '2026-07-24 09:00:00-07', '2026-07-24 10:00:00-07'),
  ('Large Conference',       'El Segundo',     'Santos Trejo Cross Exam',           '2026-07-24 09:00:00-07', '2026-07-24 17:00:00-07'),
  -- July 27
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-27 09:30:00-07', '2026-07-27 10:30:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'Mint',                              '2026-07-27 09:30:00-07', '2026-07-27 11:00:00-07'),
  ('Large Conference',       'El Segundo',     'Santos Trejo Cross exam',           '2026-07-27 09:00:00-07', '2026-07-27 17:00:00-07'),
  -- July 28
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-28 09:30:00-07', '2026-07-28 10:30:00-07'),
  ('Board Room w/ Apple TV', 'Costa Mesa',     'MESA | Amin',                       '2026-07-28 13:30:00-07', '2026-07-28 16:30:00-07'),
  ('Board Room w/ Apple TV', 'Costa Mesa',     'Entrust Janitorial Staff Meeting',  '2026-07-28 17:20:00-07', '2026-07-28 18:20:00-07'),
  ('Large Conference',       'El Segundo',     'Santo Trejo Cross Exam',            '2026-07-28 09:00:00-07', '2026-07-28 17:00:00-07'),
  -- July 29
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-29 09:30:00-07', '2026-07-29 10:30:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'Mint',                              '2026-07-29 09:00:00-07', '2026-07-29 10:00:00-07'),
  -- July 30
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-30 09:30:00-07', '2026-07-30 10:30:00-07'),
  ('Large Conference',       'El Segundo',     'Pedro Luzan Juarez Direct',         '2026-07-30 09:00:00-07', '2026-07-30 17:00:00-07'),
  -- July 31
  ('Board Room w/ Apple TV', 'Costa Mesa',     'JB',                                '2026-07-31 09:30:00-07', '2026-07-31 10:30:00-07'),
  ('Servco w/ Apple TV',     'Costa Mesa',     'Mint',                              '2026-07-31 09:00:00-07', '2026-07-31 10:00:00-07')
) AS v(room_name, location_name, title, start_time, end_time)
JOIN locations l ON l.name = v.location_name
JOIN rooms r ON r.name = v.room_name AND r.location_id = l.id
CROSS JOIN (SELECT id FROM profiles WHERE email = 'caroline@bizhaus.com') p
CROSS JOIN (SELECT id FROM companies WHERE name = 'BizHaus') c;
