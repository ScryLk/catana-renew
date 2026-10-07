"""Narrow unambiguous editorial commands; complex design remains with existing agents."""

from api.ai.text_commands import normalize


def plan_structure(user, context):
    context = context or {}
    text = normalize(user)
    words = text.split()
    if not words or not context.get("catalog_id"):
        return None
    if (
        words[0] in {"crie", "criar", "adicione", "adicionar", "create", "add"}
        and any(w in words for w in {"pagina", "page", "contracapa"})
        and "selo" not in words
    ):
        # Do not collapse compound requests into one action.
        if " e " in text or len(text) > 150:
            return None
        closing = any(
            w in text
            for w in (
                "finalizacao",
                "encerramento",
                "pagina final",
                "contracapa",
                "fechamento",
                "contato",
                "ultima pagina",
            )
        )
        after = context.get("catalog_page_count", 0)
        for pos, w in enumerate(words):
            if (
                w in {"apos", "after"}
                and pos + 2 < len(words)
                and words[pos + 1] in {"pagina", "page", "contracapa"}
            ):
                if not words[pos + 2].isdigit() or len(words[pos + 2]) > 3:
                    return None
                after = int(words[pos + 2])
        action = {
            "action": "add_page",
            "target": "catalog:pages",
            "params": {
                "afterPage": after,
                "contentRole": "closing" if closing else "hero",
                "type": "backcover" if closing else "hero",
            },
        }
    elif (
        words[0] in {"adicione", "adicionar"} and "selo" in words and "pagina" in words
    ):
        pos = words.index("pagina")
        if (
            pos + 1 >= len(words)
            or not words[pos + 1].isdigit()
            or len(words[pos + 1]) > 3
        ):
            return None
        action = {
            "action": "add_overlay",
            "target": "page:" + words[pos + 1],
            "params": {"type": "badge", "text": "", "x": 80, "y": 15},
        }
    elif (
        words[0]
        in {"remova", "remover", "apague", "duplique", "duplicar", "mova", "mover"}
        and "pagina" in words
        and "original" not in words
    ):
        positions = [i for i, w in enumerate(words) if w == "pagina"]
        if any(
            i + 1 >= len(words) or not words[i + 1].isdigit() or len(words[i + 1]) > 3
            for i in positions
        ):
            return None
        numbers = [int(words[i + 1]) for i in positions]
        name = (
            "move_page"
            if words[0] in {"mova", "mover"}
            else (
                "duplicate_page"
                if words[0] in {"duplique", "duplicar"}
                else "remove_page"
            )
        )
        params = {}
        if name == "move_page":
            if len(numbers) != 2 or not any(w in words for w in {"antes", "apos"}):
                return None
            params = {"afterPage": numbers[1] - 1 if "antes" in words else numbers[1]}
        elif len(numbers) != 1:
            return None
        action = {"action": name, "target": f"page:{numbers[0]}", "params": params}
    elif (
        words[0] in {"apague", "delete", "remova"}
        and "original" in words
        and any(w in words for w in {"pdf", "arquivo"})
    ):
        action = {"action": "delete_source", "target": "catalog:source", "params": {}}
    else:
        return None
    return "Proposta pronta para validação.", {
        "actions": [action],
        "planner_status": "proposed",
    }
