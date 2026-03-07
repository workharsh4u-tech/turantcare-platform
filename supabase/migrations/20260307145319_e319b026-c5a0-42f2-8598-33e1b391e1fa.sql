
CREATE OR REPLACE FUNCTION public.verify_patient_pin(p_patient_id uuid, p_pin text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT pin_hash INTO stored_hash FROM public.patients WHERE id = p_patient_id;
  IF stored_hash IS NULL OR stored_hash = '' THEN
    RETURN false;
  END IF;
  RETURN stored_hash = crypt(p_pin, stored_hash);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.verify_patient_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_patient_pin(uuid, text) TO anon;
