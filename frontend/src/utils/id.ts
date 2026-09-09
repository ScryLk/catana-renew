// FRG-06: IDs únicos sem colisão. `Date.now()` colide quando dois IDs são
// gerados no mesmo milissegundo (ex.: criar páginas em sequência rápida).
export function genId(prefix: string): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`;
}
