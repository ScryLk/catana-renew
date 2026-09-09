
import type { FC } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { allProducts } from '../../lib/products';


interface ProductModalProps {
  productCode: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductModal: FC<ProductModalProps> = ({ productCode, isOpen, onClose }) => {
  const product = allProducts.find(p => p.code === productCode);

  if (!product) {
    return null;
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/50 fixed inset-0 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-lg w-[90vw] max-w-4xl max-h-[85vh] overflow-y-auto p-6">
          <Dialog.Title className="text-2xl font-bold text-gray-800 mb-4">{product.name}</Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500 mb-4">
            Detalhes do produto {product.code}
          </Dialog.Description>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-100 rounded-lg flex items-center justify-center p-4">
              <img src={product.imageUrl} alt={product.name} className="max-h-80 object-contain" />
            </div>
            <div>
              <div className="flex items-center mb-2">
                <span className="text-sm font-semibold text-gray-500 uppercase mr-2">Código:</span>
                <span className="text-lg font-bold text-gray-900">{product.code}</span>
              </div>
              <div className="flex items-center mb-4">
                <span className="text-sm font-semibold text-gray-500 uppercase mr-2">Categoria:</span>
                <span className="text-md text-gray-700">{product.category}</span>
              </div>

              <div className="space-y-2 text-sm">
                {product.material && <p><span className="font-semibold">Material:</span> {product.material}</p>}
                {product.usage && <p><span className="font-semibold">Uso recomendado:</span> {product.usage}</p>}
                {product.internalDimensions && <p><span className="font-semibold">Dimensões Internas:</span> {product.internalDimensions}</p>}
                {product.externalDimensions && <p><span className="font-semibold">Dimensões Externas:</span> {product.externalDimensions}</p>}
                {product.specs && <p><span className="font-semibold">Especificações:</span> {product.specs}</p>}
                {product.caixa && <p><span className="font-semibold">Unidades por Caixa:</span> {product.caixa}</p>}
              </div>
            </div>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              aria-label="Fechar"
              onClick={onClose}
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
