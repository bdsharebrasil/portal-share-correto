import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, Camera, X } from 'lucide-react';
import { toast } from 'sonner';

interface PhotoItem {
  id?: string;
  file?: File;
  preview?: string;
  url?: string;
  description?: string;
}

interface PhotoUploadSectionProps {
  photos: PhotoItem[];
  onPhotosChange: (photos: PhotoItem[]) => void;
}

export function PhotoUploadSection({ photos, onPhotosChange }: PhotoUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState<string | undefined>(null);
  const [editingDescription, setEditingDescription] = useState('');

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    try {
      setUploading(true);
      const newPhotos = Array.from(files).map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: URL.createObjectURL(file),
        description: '',
      }));

      onPhotosChange([...photos, ...newPhotos]);
      toast.success(`${newPhotos.length} foto(s) adicionada(s)`);
    } catch (error) {
      toast.error('Erro ao adicionar fotos');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = (id: string | undefined) => {
    if (!id) return;
    const updated = photos.filter((p) => p.id !== id);
    onPhotosChange(updated);
  };

  const handleUpdateDescription = (id: string | undefined, description: string) => {
    if (!id) return;
    const updated = photos.map((p) =>
      p.id === id ? { ...p, description } : p
    );
    onPhotosChange(updated);
    setEditingPhotoId(null);
    setEditingDescription('');
  };

  const startEditingDescription = (photo: PhotoItem) => {
    setEditingPhotoId(photo.id);
    setEditingDescription(photo.description || '');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Fotos da Manutenção
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={uploading}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Enviando...' : 'Selecionar Fotos'}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Clique para selecionar ou arraste fotos aqui
          </p>
        </div>

        {/* Photos Grid */}
        {photos.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {photos.length} foto(s) selecionada(s)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="space-y-2">
                  {/* Image Preview */}
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-muted">
                    <img
                      src={photo.preview || photo.url}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white hover:text-white"
                      onClick={() => handleRemovePhoto(photo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Description */}
                  {editingPhotoId === photo.id ? (
                    <div className="space-y-2">
                      <Input
                        placeholder="Descrição..."
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        className="text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleUpdateDescription(photo.id, editingDescription)
                          }
                          className="text-xs"
                        >
                          Salvar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingPhotoId(null)}
                          className="text-xs"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {photo.description ? (
                        <p
                          onClick={() => startEditingDescription(photo)}
                          className="text-xs text-muted-foreground cursor-pointer hover:underline truncate"
                        >
                          {photo.description}
                        </p>
                      ) : (
                        <button
                          onClick={() => startEditingDescription(photo)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Adicionar descrição
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
