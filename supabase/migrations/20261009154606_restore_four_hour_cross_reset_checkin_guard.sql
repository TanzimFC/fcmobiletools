-- Restore the intended minimum four-hour interval across UTC resets.
-- A check-in remains limited to one per UTC date; this is an additional
-- guard so a claim just before midnight cannot be repeated right after reset.
DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('private.check_in_daily(uuid)'::regprocedure)
    INTO v_definition;

  IF v_definition IS NULL
     OR position('extract(epoch from (v_now-v_last)) < 86400' IN v_definition) = 0
     OR position('v_last+interval ''24 hours''' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected temporary 24-hour guard was not found; refusing to change the function.';
  END IF;

  v_definition := replace(
    v_definition,
    'extract(epoch from (v_now-v_last)) < 86400',
    'extract(epoch from (v_now-v_last)) < 14400'
  );
  v_definition := replace(
    v_definition,
    'v_last+interval ''24 hours''',
    'v_last+interval ''4 hours'''
  );

  EXECUTE v_definition;
END;
$migration$;
