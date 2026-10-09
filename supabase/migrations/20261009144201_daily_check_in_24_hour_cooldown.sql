-- Enforce a rolling 24-hour cooldown for daily check-ins.
-- Keep all existing streak, reward, and idempotency behaviour unchanged.
DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('private.check_in_daily(uuid)'::regprocedure)
    INTO v_definition;

  IF v_definition IS NULL
     OR position('extract(epoch from (v_now-v_last)) < 14400' IN v_definition) = 0
     OR position('v_last+interval ''4 hours''' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected 4-hour check-in cooldown was not found; refusing to change the function.';
  END IF;

  v_definition := replace(
    v_definition,
    'extract(epoch from (v_now-v_last)) < 14400',
    'extract(epoch from (v_now-v_last)) < 86400'
  );
  v_definition := replace(
    v_definition,
    'v_last+interval ''4 hours''',
    'v_last+interval ''24 hours'''
  );

  EXECUTE v_definition;
END;
$migration$;
