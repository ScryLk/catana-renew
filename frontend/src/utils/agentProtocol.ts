/** Defense in depth for old stored replies and partial stream chunks. Never executes prose. */
export function sanitizeAgentText(text: string): string {
  let result = "";
  let cursor = 0;
  while (cursor < text.length) {
    const opening = text.indexOf("```", cursor);
    if (opening < 0) {
      result += text.slice(cursor);
      break;
    }
    result += text.slice(cursor, opening);
    const newline = text.indexOf("\n", opening + 3);
    if (newline < 0) break;
    const tag = text
      .slice(opening + 3, newline)
      .trim()
      .toLowerCase();
    const closing = text.indexOf("```", newline + 1);
    if (closing < 0) break;
    if (!["json:patch", "patch", "json", ""].includes(tag))
      result += text.slice(opening, closing + 3);
    cursor = closing + 3;
  }
  const privateMarker =
    /(?:json:patch|DocumentIR|\{\s*"(?:actions|updates|target|policy_version)"\s*:)/i.exec(
      result,
    );
  if (privateMarker) result = result.slice(0, privateMarker.index);
  // A partial opening fence cannot flash while the next token is in flight.
  return result.replace(/`{1,2}[^`]*$/, "").trim();
}
