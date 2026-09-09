/**
 * 📦 Catana Catalog Import/Export Schema
 *
 * Define a estrutura padrão para exportação e importação de catálogos
 * Schema Version: 1.0
 */

import type { CatalogElement, HeaderFooterConfig } from './editor';
import type { DesignTokens } from './designTokens';

/**
 * Schema completo de exportação de catálogo
 */
export interface CatalogExportSchema {
  // Metadados técnicos
  schemaVersion: '1.0';
  exportedAt: string; // ISO 8601
  app: 'Catana';

  // Metadados do catálogo
  catalog: {
    name: string;
    description?: string;
    dimensions?: {
      width: number;
      height: number;
      unit: 'px' | 'mm' | 'cm' | 'in';
    };
    organization?: string; // Nome (não ID)
    sede?: string; // Nome (não ID)
    createdAt?: string;
    updatedAt?: string;
  };

  // Configurações globais
  settings?: {
    gridSize?: number;
    snapToGrid?: boolean;
    defaultZoom?: number;
  };

  // 🎨 Design Tokens (NOVO - para IA-first)
  designTokens?: DesignTokens;

  // Estrutura de páginas
  pages: ExportPage[];
}

/**
 * Página exportada (sem IDs reais do banco)
 */
export interface ExportPage {
  logicalId: string; // ID lógico temporário para referência interna
  name: string;
  order: number;
  elements: ExportElement[];
  header?: HeaderFooterConfig;
  footer?: HeaderFooterConfig;
}

/**
 * Elemento exportado (sem IDs reais do banco)
 */
export interface ExportElement {
  logicalId: string; // ID lógico temporário
  type: CatalogElement['type'];
  name?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex?: number;
  visible?: boolean;
  locked?: boolean;
  rotation?: number;
  opacity?: number;

  // Group data
  isGroup?: boolean;
  groupId?: string; // Referência ao logicalId do grupo
  children?: string[]; // Array de logicalIds

  // Style
  style?: CatalogElement['style'];
  className?: CatalogElement['className'];

  // Content específico por tipo
  content?: any;
  textData?: CatalogElement['textData'];
  productData?: CatalogElement['productData'];
  imageUrl?: CatalogElement['imageUrl'];
  imageData?: CatalogElement['imageData'];
  highlightBannerData?: CatalogElement['highlightBannerData'];
  testimonialData?: CatalogElement['testimonialData'];
  qrCodeData?: CatalogElement['qrCodeData'];
  lineData?: CatalogElement['lineData'];
  // ... outros tipos de dados
}

/**
 * Resultado da validação do schema
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'critical' | 'error';
  field: string;
  message: string;
}

export interface ValidationWarning {
  type: 'warning';
  field: string;
  message: string;
}

/**
 * Preview de importação (para mostrar ao usuário antes de confirmar)
 */
export interface ImportPreview {
  catalogName: string;
  description?: string;
  pageCount: number;
  elementCount: number;
  schemaVersion: string;
  exportedAt: string;
  organization?: string;
  sede?: string;
  warnings: ValidationWarning[];
}

/**
 * Opções de importação
 */
export interface ImportOptions {
  // Organização e Sede de destino (obtidas do contexto ativo)
  targetOrganization?: string;
  targetSede?: string;

  // Opções de conflito (futuro)
  onConflict?: 'skip' | 'rename' | 'overwrite'; // MVP: sempre criar novo

  // Tratamento de mídias
  preserveExternalUrls?: boolean; // Default: true
}

/**
 * Resultado da importação
 */
export interface ImportResult {
  success: boolean;
  catalogId?: string;
  catalogName?: string;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}
