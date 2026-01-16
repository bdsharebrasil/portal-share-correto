-- Update client_aircraft.share_percentage to support decimal values
ALTER TABLE client_aircraft
ALTER COLUMN share_percentage TYPE numeric(5,2);
