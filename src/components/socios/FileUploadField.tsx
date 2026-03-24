import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FileUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  accept?: string;
  bucket?: string;
  prefix?: string;
  disabled?: boolean;
}

export function FileUploadField({
  value,
  onChange,
  label = "Anexar arquivo",
  accept = ".pdf,.jpg,.jpeg,.png",
  bucket = "nfs-share-recebidas",
  prefix = "file",
  disabled = false,
}: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const inputId = `upload-${prefix}-${Math.random().toString(36).slice(2, 8)}`;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const timestamp = Date.now();
      const sanitized = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").substring(0, 100);
      const ext = sanitized.split(".").pop();
      const fileName = `${prefix}_${timestamp}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
      onChange(data.publicUrl);
      toast.success("Arquivo anexado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 p-2.5 bg-muted rounded-xl border border-border/50">
        <FileText className="h-4 w-4 text-primary flex-shrink-0" />
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex-1 truncate"
        >
          Arquivo anexado
        </a>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange("")}
          className="h-6 w-6 p-0"
          disabled={disabled}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <input
        type="file"
        accept={accept}
        onChange={handleUpload}
        disabled={uploading || disabled}
        className="hidden"
        id={inputId}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => document.getElementById(inputId)?.click()}
        disabled={uploading || disabled}
        className="w-full gap-2 h-10 rounded-xl border-dashed border-border/60 text-sm"
      >
        <Upload className="h-3.5 w-3.5" />
        {uploading ? "Enviando..." : label}
      </Button>
    </>
  );
}
