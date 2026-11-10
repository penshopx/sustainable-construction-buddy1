import SchemeReferenceView from "./SchemeReferenceView";
import { useSchemeReferenceBank } from "@/hooks/useSchemeReferenceBank";

export default function SchemeReferencePanel() {
  return <SchemeReferenceView {...useSchemeReferenceBank()} />;
}
