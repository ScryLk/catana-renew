/**
 * Hierarchy Helpers - Gerenciamento de árvore de componentes
 * Parte da ETAPA 2: Modelo de Dados e Hierarquia
 */

import type { CatalogElement, Position } from '../types/editor';

/**
 * Adiciona um filho a um parent
 */
export const addChild = (
  elements: CatalogElement[],
  parentId: string,
  childId: string
): CatalogElement[] => {
  return elements.map((el) => {
    if (el.id === parentId) {
      const children = el.children || [];
      if (!children.includes(childId)) {
        return {
          ...el,
          children: [...children, childId],
        };
      }
    }
    return el;
  });
};

/**
 * Remove um filho de um parent
 */
export const removeChild = (
  elements: CatalogElement[],
  parentId: string,
  childId: string
): CatalogElement[] => {
  return elements.map((el) => {
    if (el.id === parentId) {
      const children = el.children || [];
      return {
        ...el,
        children: children.filter((id) => id !== childId),
      };
    }
    return el;
  });
};

/**
 * Move um componente para um novo parent
 * Converte coordenadas globais para locais do novo parent
 */
export const reparent = (
  elements: CatalogElement[],
  childId: string,
  newParentId: string | null,
  oldParentId: string | null
): CatalogElement[] => {
  const child = elements.find((el) => el.id === childId);
  const newParent = newParentId ? elements.find((el) => el.id === newParentId) : null;
  const oldParent = oldParentId ? elements.find((el) => el.id === oldParentId) : null;

  if (!child) return elements;

  // Calcular posição global atual
  let globalPosition = { ...child.position };
  if (oldParent) {
    globalPosition = {
      x: child.position.x + oldParent.position.x,
      y: child.position.y + oldParent.position.y,
    };
  }

  // Calcular nova posição local
  let newLocalPosition = globalPosition;
  if (newParent) {
    newLocalPosition = {
      x: globalPosition.x - newParent.position.x,
      y: globalPosition.y - newParent.position.y,
    };
  }

  // Atualizar elementos
  let updatedElements = elements.map((el) => {
    if (el.id === childId) {
      return {
        ...el,
        groupId: newParentId || undefined,
        position: newLocalPosition,
      };
    }
    return el;
  });

  // Remover do parent antigo
  if (oldParentId) {
    updatedElements = removeChild(updatedElements, oldParentId, childId);
  }

  // Adicionar ao novo parent
  if (newParentId) {
    updatedElements = addChild(updatedElements, newParentId, childId);
  }

  return updatedElements;
};

/**
 * Converte coordenadas locais para globais
 */
export const localToGlobal = (
  position: Position,
  element: CatalogElement,
  allElements: CatalogElement[]
): Position => {
  const globalPos = { ...position };
  let current = element;

  // Subir na hierarquia somando posições
  while (current.groupId) {
    const parent = allElements.find((el) => el.id === current.groupId);
    if (!parent) break;
    globalPos.x += parent.position.x;
    globalPos.y += parent.position.y;
    current = parent;
  }

  return globalPos;
};

/**
 * Converte coordenadas globais para locais (relativas a um parent)
 */
export const globalToLocal = (
  globalPosition: Position,
  parentElement: CatalogElement | null,
  allElements: CatalogElement[]
): Position => {
  if (!parentElement) return globalPosition;

  const parentGlobalPos = localToGlobal(parentElement.position, parentElement, allElements);

  return {
    x: globalPosition.x - parentGlobalPos.x,
    y: globalPosition.y - parentGlobalPos.y,
  };
};

/**
 * Retorna todos os descendentes de um elemento
 */
export const getDescendants = (
  elementId: string,
  allElements: CatalogElement[]
): CatalogElement[] => {
  const element = allElements.find((el) => el.id === elementId);
  if (!element || !element.children) return [];

  const descendants: CatalogElement[] = [];

  const collectDescendants = (id: string) => {
    const el = allElements.find((e) => e.id === id);
    if (!el) return;

    descendants.push(el);

    if (el.children) {
      el.children.forEach(collectDescendants);
    }
  };

  element.children.forEach(collectDescendants);

  return descendants;
};

/**
 * Retorna todos os ancestrais de um elemento
 */
export const getAncestors = (
  elementId: string,
  allElements: CatalogElement[]
): CatalogElement[] => {
  const ancestors: CatalogElement[] = [];
  let current = allElements.find((el) => el.id === elementId);

  while (current?.groupId) {
    const parent = allElements.find((el) => el.id === current!.groupId);
    if (!parent) break;
    ancestors.push(parent);
    current = parent;
  }

  return ancestors;
};

/**
 * Verifica se um elemento é ancestral de outro
 */
export const isAncestor = (
  potentialAncestorId: string,
  elementId: string,
  allElements: CatalogElement[]
): boolean => {
  const ancestors = getAncestors(elementId, allElements);
  return ancestors.some((ancestor) => ancestor.id === potentialAncestorId);
};

/**
 * Retorna elementos de nível superior (sem parent)
 */
export const getTopLevelElements = (elements: CatalogElement[]): CatalogElement[] => {
  return elements.filter((el) => !el.groupId);
};

/**
 * Ordena elementos por z-index
 */
export const sortByZIndex = (elements: CatalogElement[]): CatalogElement[] => {
  return [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
};

/**
 * Calcula a distância de um ponto até uma linha
 */
function pointToLineDistance(
  point: Position,
  lineStart: Position,
  lineEnd: Position
): number {
  const { x: px, y: py } = point;
  const { x: x1, y: y1 } = lineStart;
  const { x: x2, y: y2 } = lineEnd;

  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Encontra o elemento no topo em uma posição (hit testing)
 */
export const findTopElementAtPoint = (
  point: Position,
  elements: CatalogElement[],
  _zoom: number
): CatalogElement | null => {
  // Ordenar por z-index decrescente (do topo para baixo)
  const sorted = sortByZIndex(elements).reverse();

  for (const el of sorted) {
    if (el.locked || !el.visible) continue;

    // Hit test especial para linhas
    if (el.type === 'line' && el.lineData) {
      const lineData = el.lineData;

      // ✅ NOVO: lineData já tem coordenadas ABSOLUTAS em world space
      // Não somar el.position (que é sempre {0, 0} para linhas)
      const start = {
        x: lineData.start.x,
        y: lineData.start.y,
      };
      const end = {
        x: lineData.end.x,
        y: lineData.end.y,
      };

      // Calcular distância do ponto até a linha
      const distToLine = pointToLineDistance(point, start, end);
      // Threshold MUITO generoso para seleção durante desenvolvimento
      const threshold = 1000;

      if (distToLine <= threshold) {
        return el;
      }
      continue;
    }

    // Hit test padrão (bounding box)
    const bounds = {
      x: el.position.x,
      y: el.position.y,
      width: el.size.width,
      height: el.size.height,
    };

    if (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    ) {
      return el;
    }
  }

  return null;
};
