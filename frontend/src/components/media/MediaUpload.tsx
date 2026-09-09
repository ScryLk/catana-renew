import { useState, useRef, useCallback } from 'react';
import type { FC, DragEvent, ChangeEvent } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { mediaService, type UploadMediaData } from '@/services/mediaService';
import { cn } from '@/lib/utils';

interface MediaUploadProps {
  folderId?: number;
  onUploadComplete?: () => void;
  onClose?: () => void;
}

interface UploadProgress {
  file: File;
  name: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export const MediaUpload: FC<MediaUploadProps> = ({ folderId, onUploadComplete, onClose }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [tags, setTags] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    const newUploads: UploadProgress[] = files.map((file) => ({
      file,
      name: file.name.replace(/\.[^/.]+$/, ''), // Remove extensão
      status: 'pending',
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    // Iniciar uploads
    newUploads.forEach((upload) => uploadFile(upload));
  };

  const uploadFile = async (upload: UploadProgress) => {
    // Atualizar status para uploading
    setUploads((prev) =>
      prev.map((u) => (u.file === upload.file ? { ...u, status: 'uploading' } : u))
    );

    try {
      const tagsList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const data: UploadMediaData = {
        file: upload.file,
        name: upload.name,
        folder: folderId,
        tags: tagsList.length > 0 ? tagsList : undefined,
      };

      await mediaService.uploadMedia(data);

      // Atualizar status para success
      setUploads((prev) =>
        prev.map((u) => (u.file === upload.file ? { ...u, status: 'success' } : u))
      );

      onUploadComplete?.();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      setUploads((prev) =>
        prev.map((u) =>
          u.file === upload.file
            ? { ...u, status: 'error', error: 'Erro ao fazer upload' }
            : u
        )
      );
    }
  };

  const removeUpload = (file: File) => {
    setUploads((prev) => prev.filter((u) => u.file !== file));
  };

  const updateName = (file: File, newName: string) => {
    setUploads((prev) => prev.map((u) => (u.file === file ? { ...u, name: newName } : u)));
  };

  const allCompleted = uploads.length > 0 && uploads.every((u) => u.status === 'success');

  return (
    <Card>
      <CardContent className="p-6">
        {/* Área de drag & drop */}
        <div
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Arraste arquivos aqui</h3>
          <p className="text-sm text-muted-foreground mb-4">
            ou clique para selecionar do seu computador
          </p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="mb-2"
          >
            Selecionar Arquivos
          </Button>
          <p className="text-xs text-muted-foreground">
            Suporta imagens, vídeos e documentos
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInput}
            accept="image/*,video/*,.pdf,.doc,.docx"
          />
        </div>

        {/* Tags globais */}
        {uploads.length > 0 && (
          <div className="mt-4">
            <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
            <Input
              id="tags"
              placeholder="ex: logo, branding, marketing"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="mt-1"
            />
          </div>
        )}

        {/* Lista de uploads */}
        {uploads.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="font-semibold">Arquivos ({uploads.length})</h4>
            {uploads.map((upload) => (
              <Card key={upload.file.name} className="p-3">
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {upload.status === 'uploading' && (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    )}
                    {upload.status === 'success' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {upload.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    {upload.status === 'pending' && (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                    )}
                  </div>

                  {/* Nome do arquivo */}
                  <div className="flex-1 min-w-0">
                    {upload.status === 'pending' ? (
                      <Input
                        value={upload.name}
                        onChange={(e) => updateName(upload.file, e.target.value)}
                        className="h-8"
                        placeholder="Nome do arquivo"
                      />
                    ) : (
                      <div>
                        <p className="text-sm font-medium truncate">{upload.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    )}
                    {upload.error && (
                      <p className="text-xs text-destructive mt-1">{upload.error}</p>
                    )}
                  </div>

                  {/* Botão remover */}
                  {upload.status !== 'uploading' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeUpload(upload.file)}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Botões de ação */}
        {uploads.length > 0 && (
          <div className="flex gap-2 mt-6">
            {allCompleted && onClose && (
              <Button onClick={onClose} className="flex-1">
                Concluído
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
