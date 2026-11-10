import { useRef } from "react";
import { type LkutDocument } from "@/hooks/useLkutDocuments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Image, FileSpreadsheet, Trash2, Loader2 } from "lucide-react";

interface Props {
  component: string;
  label: string;
  documents: LkutDocument[];
  uploading: boolean;
  acceptString: string;
  onUpload: (file: File, component: string) => Promise<boolean>;
  onDelete: (doc: LkutDocument) => void;
  disabled?: boolean;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="w-4 h-4 text-pub-emerald shrink-0" />;
  if (type.includes("spreadsheet") || type.includes("excel")) return <FileSpreadsheet className="w-4 h-4 text-pub-emerald shrink-0" />;
  return <FileText className="w-4 h-4 text-primary shrink-0" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LkutDocumentUpload({ component, label, documents, uploading, acceptString, onUpload, onDelete, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await onUpload(files[i], component);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Upload className="w-3 h-3" />
          Bukti {label}
          {documents.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{documents.length}</Badge>
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptString}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {documents.length > 0 && (
        <div className="space-y-1">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border text-xs group">
              {fileIcon(doc.file_type)}
              <a
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-foreground hover:underline"
                title={doc.file_name}
              >
                {doc.file_name}
              </a>
              <span className="text-muted-foreground shrink-0">{formatSize(doc.file_size)}</span>
              {!disabled && (
                <button
                  onClick={() => onDelete(doc)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                  title="Hapus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
