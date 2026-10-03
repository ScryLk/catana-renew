export type AgentCursorRole = 'orchestrator' | 'director' | 'copywriter' | 'commercial' | 'branding';

export interface AgentCursor {
  id: string;
  roleId: AgentCursorRole;
  name: string;
  roleLabel: string;
  initials: string;
  color: string;
  startX?: number; // Origem X do trajeto no canvas (0 a 100)
  startY?: number; // Origem Y do trajeto no canvas (0 a 100)
  x: number; // Destino X da acao no canvas (0 a 100)
  y: number; // Destino Y da acao no canvas (0 a 100)
  actionText: string;
  targetElementId?: string;
  isActing: boolean;
  timestamp: number;
}

export interface AgentRoleConfig {
  roleId: AgentCursorRole;
  name: string;
  roleLabel: string;
  initials: string;
  color: string;
  defaultPosition: { x: number; y: number };
  originPosition: { x: number; y: number };
}

export const AGENT_CURSOR_CONFIGS: Record<AgentCursorRole, AgentRoleConfig> = {
  director: {
    roleId: 'director',
    name: 'Diretor de Arte',
    roleLabel: 'Design & Proporcao',
    initials: 'DA',
    color: '#B08D57',
    defaultPosition: { x: 32, y: 38 },
    originPosition: { x: 6, y: 30 },
  },
  copywriter: {
    roleId: 'copywriter',
    name: 'Redator Publicitario',
    roleLabel: 'Copywriting & Textos',
    initials: 'RP',
    color: '#71717A',
    defaultPosition: { x: 28, y: 62 },
    originPosition: { x: 14, y: 88 },
  },
  commercial: {
    roleId: 'commercial',
    name: 'Tabela Comercial',
    roleLabel: 'B2B & Precificacao',
    initials: 'TC',
    color: '#3B82F6',
    defaultPosition: { x: 72, y: 48 },
    originPosition: { x: 92, y: 42 },
  },
  branding: {
    roleId: 'branding',
    name: 'Auditor de Branding',
    roleLabel: 'Identidade & Diretrizes',
    initials: 'AB',
    color: '#8B5CF6',
    defaultPosition: { x: 50, y: 22 },
    originPosition: { x: 82, y: 8 },
  },
  orchestrator: {
    roleId: 'orchestrator',
    name: 'Editor-Chefe',
    roleLabel: 'Orquestracao',
    initials: 'EC',
    color: '#06B6D4',
    defaultPosition: { x: 45, y: 15 },
    originPosition: { x: 20, y: 6 },
  },
};
