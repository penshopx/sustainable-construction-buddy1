
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Service can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: notify on level change
CREATE OR REPLACE FUNCTION public.notify_level_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF OLD.current_level IS DISTINCT FROM NEW.current_level THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.user_id,
      'level_up',
      'Selamat! Level Anda Naik 🎉',
      'Anda telah naik ke level ' || NEW.current_level || '. Terus tingkatkan kompetensi Anda!'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_level_change
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_level_change();

-- Trigger: notify on new certificate
CREATE OR REPLACE FUNCTION public.notify_new_certificate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    NEW.user_id,
    'certificate',
    'Sertifikat Baru Diterbitkan 🏆',
    'Sertifikat level ' || NEW.level || ' dengan nomor ' || NEW.certificate_number || ' telah diterbitkan.'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_certificate
AFTER INSERT ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.notify_new_certificate();
