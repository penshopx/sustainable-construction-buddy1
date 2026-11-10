-- Expand the monitored construction-information catalogue. Official/public
-- procurement sources are primary; media and directories remain secondary
-- and always enter the editorial review queue before publication.
INSERT INTO public.information_sources
  (name, domain, base_url, source_type, trust_level, check_interval_minutes)
VALUES
  ('INAPROC SPSE Nasional', 'spse.inaproc.id', 'https://spse.inaproc.id/nasional', 'official', 'primary', 60),
  ('Konstruksi Media', 'konstruksimedia.com', 'https://konstruksimedia.com', 'industry', 'secondary', 120),
  ('Indokontraktor', 'indokontraktor.com', 'https://indokontraktor.com', 'industry', 'secondary', 120),
  ('Media Konstruksi', 'mediakonstruksi.id', 'https://mediakonstruksi.id', 'industry', 'secondary', 120),
  ('Konstruksi News', 'konstruksinews.id', 'https://konstruksinews.id', 'industry', 'secondary', 120),
  ('CNBC Indonesia — Konstruksi', 'cnbcindonesia.com', 'https://www.cnbcindonesia.com/tag/konstruksi', 'industry', 'secondary', 120),
  ('Top Konstruksi', 'topkonstruksi.com', 'https://topkonstruksi.com', 'industry', 'secondary', 120),
  ('Info Infrastruktur', 'infoinfrastruktur.com', 'https://infoinfrastruktur.com', 'industry', 'secondary', 120),
  ('Teknik Sipil', 'tekniksipil.id', 'https://tekniksipil.id', 'industry', 'secondary', 120),
  ('LSBU Konstruksi', 'lsbukonstruksi.co.id', 'https://lsbukonstruksi.co.id', 'institution', 'primary', 60)
ON CONFLICT (domain) DO UPDATE SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  source_type = EXCLUDED.source_type,
  trust_level = EXCLUDED.trust_level,
  check_interval_minutes = EXCLUDED.check_interval_minutes,
  is_active = true;