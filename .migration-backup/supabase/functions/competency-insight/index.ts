import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCompetencyInsightHandler } from "./handler.js";

serve(createCompetencyInsightHandler({
  createClient,
  getEnv: (key: string) => Deno.env.get(key),
}));