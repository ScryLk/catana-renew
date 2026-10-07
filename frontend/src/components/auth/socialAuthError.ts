/** Only error codes are inspected; provider payloads and credentials never enter UI/logs. */
export function socialAuthError(error: unknown): string {
  const errors = typeof error === 'object' && error !== null && 'errors' in error
    ? (error as { errors?: unknown }).errors : undefined;
  const code = Array.isArray(errors) && typeof errors[0]?.code === 'string' ? errors[0].code : '';
  if (['oauth_access_denied', 'oauth_cancelled', 'user_cancelled'].includes(code))
    return 'O acesso com o Google foi cancelado. Você pode tentar novamente.';
  if (['oauth_strategy_not_enabled', 'strategy_not_supported', 'form_param_value_invalid'].includes(code))
    return 'O acesso com o Google não está disponível. Use outra forma de acesso ou contate o suporte.';
  return 'Não foi possível acessar com o Google. Tente novamente ou use outra forma de acesso.';
}

