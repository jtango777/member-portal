-- Fix Costa Mesa Library East and Library West capacity to 6 each
UPDATE rooms SET capacity = 6
WHERE name = 'Library East'
  AND location_id = '11111111-1111-1111-1111-111111111103';

UPDATE rooms SET capacity = 6
WHERE name = 'Library West'
  AND location_id = '11111111-1111-1111-1111-111111111103';
