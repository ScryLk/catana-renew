// FRG-06: logger de debug condicionado ao ambiente. Substitui console.log
// direto (e o gating inline `import.meta.env.DEV && console.log` que disparava
// no-unused-expressions). Em produção é no-op.
export const logger = {
  debug: (...args: unknown[]): void => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  },
};
