import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { AgentChatStream } from "./AgentChatStream";
import { useStudioStore } from "../../store/studioStore";
it.each(['```json:patch\n{"actions":[', '```patch\n{"actions":[]}\n```'])(
  "renders old or partial assistant replies without private protocol",
  async (raw) => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();
    useStudioStore.setState({
      messages: [
        { id: "stored", role: "assistant", content: raw.startsWith("```patch") ? raw : "Proposta.\n" + raw, actions: [raw, raw], delegations: [{roleId: "director", roleName: "Diretor", badge: "Design", action: raw}] },
      ],
      agentStatus: "idle",
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(<AgentChatStream />));
      for (let i = 0; i < 25; i++)
        await act(async () => {
          await vi.advanceTimersByTimeAsync(40);
        });
      expect(container.textContent).toContain(raw.startsWith("```patch") ? "Nenhuma alteração confirmada" : "Proposta.");
      expect(container.textContent).not.toContain("executado com sucesso");
      expect(container.textContent).not.toContain("```");
      expect(container.textContent).not.toContain("actions");
    } finally {
      await act(async () => root.unmount());
      container.remove();
      vi.useRealTimers();
    }
  },
);
