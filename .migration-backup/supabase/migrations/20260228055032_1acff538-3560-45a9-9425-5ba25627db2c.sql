
CREATE OR REPLACE FUNCTION public.notify_innovation_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'approved' THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.user_id,
      'innovation_approved',
      '✅ Proposal Inovasi Disetujui',
      'Proposal "' || NEW.title || '" telah disetujui.' || 
      CASE WHEN NULLIF(NEW.admin_notes, '') IS NOT NULL THEN ' Catatan: ' || NEW.admin_notes ELSE '' END
    );
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.user_id,
      'innovation_rejected',
      '⚠️ Proposal Inovasi Ditolak',
      'Proposal "' || NEW.title || '" ditolak.' ||
      CASE WHEN NULLIF(NEW.admin_notes, '') IS NOT NULL THEN ' Catatan: ' || NEW.admin_notes ELSE '' END
    );
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'reviewed' THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.user_id,
      'innovation_reviewed',
      '📋 Proposal Inovasi Direview',
      'Proposal "' || NEW.title || '" telah direview oleh admin.' ||
      CASE WHEN NULLIF(NEW.admin_notes, '') IS NOT NULL THEN ' Catatan: ' || NEW.admin_notes ELSE '' END
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_innovation_status_change
  BEFORE UPDATE ON public.innovation_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_innovation_status();
