import type { FC } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { Media } from '@/types/api';

interface MediaPreviewDialogProps {
    media: Media | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const MediaPreviewDialog: FC<MediaPreviewDialogProps> = ({
    media,
    open,
    onOpenChange,
}) => {
    if (!media) return null;

    const handleDownload = async () => {
        try {
            const response = await fetch(media.file);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = media.name || `download-${media.id}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading file:', error);
            window.open(media.file, '_blank');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border border-white/20 shadow-2xl sm:rounded-xl">
                <DialogTitle className="sr-only">{media.name}</DialogTitle>
                <DialogDescription className="sr-only">
                    Preview of {media.name}
                </DialogDescription>
                <div className="relative w-full h-full flex flex-col items-center justify-center min-h-[50vh] max-h-[90vh]">

                    {/* Media Content */}
                    <div className="flex-1 w-full flex items-center justify-center p-4 overflow-auto">
                        {media.media_type === 'image' ? (
                            <img
                                src={media.file}
                                alt={media.name}
                                className="max-w-full max-h-full object-contain"
                            />
                        ) : media.media_type === 'video' ? (
                            <video
                                src={media.file}
                                controls
                                className="max-w-full max-h-full"
                                autoPlay
                            />
                        ) : (
                            <div className="text-white text-center">
                                <p className="text-lg font-medium mb-4">Pré-visualização não disponível para este tipo de arquivo.</p>
                                <Button onClick={handleDownload} variant="secondary">
                                    <Download className="mr-2 h-4 w-4" />
                                    Baixar Arquivo
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Footer Info */}
                    <div className="w-full bg-black/50 p-4 text-white flex justify-between items-center backdrop-blur-sm">
                        <div>
                            <h3 className="font-medium text-lg">{media.name}</h3>
                            <p className="text-sm text-white/60">
                                {media.media_type === 'image' && media.width && media.height && (
                                    `${media.width} x ${media.height} • `
                                )}
                                {media.file_size_formatted}
                            </p>
                        </div>
                        <Button onClick={handleDownload} variant="secondary" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Download
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
