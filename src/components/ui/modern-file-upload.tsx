import { useState } from "react";
import { Upload, X, File, Image as ImageIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModernFileUploadProps {
  label: string;
  accept?: string;
  onChange: (file: File | null) => void;
  currentFile?: File | null;
  uploadedUrl?: string;
  disabled?: boolean;
  allowedFormats?: string[];
}

export function ModernFileUpload({
  label,
  accept = ".pdf,.png,.jpg,.jpeg,.gif,.webp",
  onChange,
  currentFile,
  uploadedUrl,
  disabled = false,
  allowedFormats = ["PDF", "PNG", "JPG", "JPEG", "GIF", "WEBP"],
}: ModernFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (isValidFile(file)) {
        onChange(file);
        generatePreview(file);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (isValidFile(file)) {
        onChange(file);
        generatePreview(file);
      }
    }
  };

  const isValidFile = (file: File): boolean => {
    const validTypes = accept
      .split(",")
      .map((t) => t.trim().toLowerCase().replace(".", ""));
    const fileExtension = file.nome.split(".").pop()?.toLowerCase();
    return fileExtension ? validTypes.includes(fileExtension) : false;
  };

  const generatePreview = (file: File) => {
    if (file.tipo.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleClear = () => {
    onChange(null);
    setPreview(null);
  };

  const getFileIcon = (file?: File | null) => {
    if (!file) return null;

    const type = file.tipo.toLowerCase();
    if (type.startsWith("image/")) {
      return <ImageIcon className="h-4 w-4" />;
    }
    if (type.includes("pdf")) {
      return <FileText className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  const displayFile = currentFile || uploadedUrl;
  const fileName = currentFile?.nome || (uploadedUrl ? "Arquivo já enviado" : null);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground block">
        {label}
      </label>

      {displayFile ? (
        <div className="relative group">
          {preview ? (
            <div className="relative w-full bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800 rounded-lg border-2 border-primary/20 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-40 object-cover"
              />
              <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                <button
                  onClick={handleClear}
                  className="bg-destructive/90 hover:bg-destructive text-white rounded-full p-2 transition-colors"
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 p-3 bg-gradient-to-r from-success/10 to-success/5 border-2 border-success/20 rounded-lg">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 text-success">
                  {getFileIcon(currentFile)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-success truncate">
                    ✓ {fileName}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClear}
                className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1.5 hover:bg-destructive/10 rounded-md"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden",
            isDragging
              ? "border-primary bg-primary/10 shadow-md"
              : "border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 hover:border-primary/50 hover:bg-primary/5",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <input
            type="file"
            accept={accept}
            onChange={handleFileInput}
            disabled={disabled}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label={label}
          />

          <div className="flex flex-col items-center justify-center gap-2 py-6 px-4">
            <div
              className={cn(
                "p-3 rounded-lg transition-all",
                isDragging
                  ? "bg-primary/20 text-primary scale-110"
                  : "bg-primary/10 text-primary/70 hover:bg-primary/15 hover:text-primary"
              )}
            >
              <Upload className="h-5 w-5" />
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">
                {isDragging ? "Solte o arquivo aqui" : "Arrastar ou clique para enviar"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allowedFormats.join(", ")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
