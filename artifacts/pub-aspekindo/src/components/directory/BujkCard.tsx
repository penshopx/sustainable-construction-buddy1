import { Building2, MapPin, Phone, Mail, Globe, Award, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BujkEntry } from "@/hooks/useBujkDirectory";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const qualLabel: Record<string, string> = {
  kecil: "Kecil",
  menengah: "Menengah",
  besar: "Besar",
};

const qualColor: Record<string, string> = {
  kecil: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  menengah: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  besar: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export default function BujkCard({ entry }: { entry: BujkEntry }) {
  const navigate = useNavigate();
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/direktori/${entry.id}`)}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-heading font-semibold text-foreground truncate">{entry.company_name}</h3>
              {entry.city && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {entry.city}{entry.province ? `, ${entry.province}` : ""}
                </p>
              )}
            </div>
          </div>
          <Badge className={qualColor[entry.qualification] || ""} variant="secondary">
            {qualLabel[entry.qualification] || entry.qualification}
          </Badge>
        </div>

        {entry.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{entry.description}</p>
        )}

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {entry.sub_classification && (
            <span className="flex items-center gap-1"><Award className="w-3 h-3" /> {entry.sub_classification}</span>
          )}
          {entry.sbu_number && (
            <span className="flex items-center gap-1">SBU: {entry.sbu_number}</span>
          )}
          {entry.sbu_expiry && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> s.d. {format(new Date(entry.sbu_expiry), "dd MMM yyyy", { locale: id })}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1 border-t">
          {entry.phone && (
            <a href={`tel:${entry.phone}`} className="flex items-center gap-1 hover:text-primary transition-colors">
              <Phone className="w-3 h-3" /> {entry.phone}
            </a>
          )}
          {entry.email && (
            <a href={`mailto:${entry.email}`} className="flex items-center gap-1 hover:text-primary transition-colors">
              <Mail className="w-3 h-3" /> {entry.email}
            </a>
          )}
          {entry.website && (
            <a href={entry.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
              <Globe className="w-3 h-3" /> Website
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
