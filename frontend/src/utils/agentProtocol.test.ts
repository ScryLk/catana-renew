import { expect, it } from "vitest";
import { sanitizeAgentText } from "./agentProtocol";
it.each([
  '```json:patch\n{"actions":[',
  "```patch\n{}\n```",
  "```json:patch",
  "```json:pa",
  '```json\n{"actions":[]}\n```',
  '{"actions":[{"target":"secret"}]}',
])("suppresses private or truncated protocol: %s", (raw) => {
  expect(sanitizeAgentText("Proposta.\n" + raw)).toBe("Proposta.");
});
it("retains human text surrounding a complete private block", () =>
  expect(sanitizeAgentText("Antes\n```json:patch\n{}\n```\nDepois")).toBe(
    "Antes\n\nDepois",
  ));
