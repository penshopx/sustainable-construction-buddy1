
CREATE OR REPLACE FUNCTION public.notify_pancek_verification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'verified' THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.user_id,
      'pancek_verified',
      '✅ PANCEK Terverifikasi oleh Asosiasi',
      'Asesmen PANCEK periode ' || NEW.period_year || ' untuk ' || COALESCE(NULLIF(NEW.company_name, ''), 'perusahaan Anda') || ' telah diverifikasi oleh Asosiasi. Silakan unduh laporan PDF sebagai lampiran perpanjangan SBU.'
    );
  END IF;
  
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.user_id,
      'pancek_rejected',
      '⚠️ PANCEK Perlu Perbaikan',
      'Asesmen PANCEK periode ' || NEW.period_year || ' memerlukan perbaikan. Catatan verifikator: ' || COALESCE(NULLIF(NEW.verification_notes, ''), '-')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_pancek_verification_notification
  AFTER UPDATE ON public.pancek_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pancek_verification();
