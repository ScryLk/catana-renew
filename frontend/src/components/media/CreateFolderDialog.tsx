import { useState } from 'react';
import type { FC } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { FormEvent } from 'react'; // Added FormEvent import

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFolder: (name: string) => Promise<void>;
  parentFolderName?: string;
}

export const CreateFolderDialog: FC<CreateFolderDialogProps> = ({
  open,
  onOpenChange,
  onCreateFolder,
  parentFolderName,
}) => {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Removed error state as per the instruction's implied changes

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return; // Simplified error check

    try {
      setIsLoading(true);
      await onCreateFolder(name);
      setName('');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao criar pasta:', error); // Changed error handling
    } finally {
      setIsLoading(false);
    }
  };

  // Removed handleClose function as per the instruction's implied changes

  return (
    <Dialog open={open} onOpenChange={onOpenChange}> {/* Changed onOpenChange handler */}
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova Pasta</DialogTitle> {/* Changed title */}
            <DialogDescription>
              {parentFolderName
                ? `Crie uma nova pasta dentro de "${parentFolderName}".`
                : 'Crie uma nova pasta para organizar seus arquivos.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="folder-name">Nome da Pasta</Label>
              <Input
                id="folder-name"
                placeholder="Digite o nome da pasta..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Pasta'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
