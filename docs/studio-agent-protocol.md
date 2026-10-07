# Studio agent protocol

The model's fenced JSON is a private model protocol. It terminates in `api/services/agent_output.py`; it is never a frontend execution source.

## Channels

1. Frontend creates one UUID `client_request_id` and stable user/assistant turn IDs.
2. `authenticatedStreamingFetch` obtains the same provider token used by Axios. Only an HTTP 401 before body consumption can retry, once, preserving the request body/UUID. Once SSE begins, read failures are reported and never replayed.
3. Backend buffers model output, then the deterministic parser returns human text, a patch candidate, and `none`, `valid`, or `invalid` protocol status.
4. The existing ActionPolicyRouter normalizes and validates candidates. Source integrity, commercial integrity, schema validation, confirmation and tenant ownership remain authoritative.
5. Public token events carry only human prose. Accepted actions arrive in structured `patch` events; `done.patch` is a compatibility copy and the frontend executes at most once, after a completed done event. An interrupted proposal is never applied. Rejected actions produce readable policy feedback and structured action-policy metadata.
6. Frontend applies accepted actions, waits for persistence, then reports ActionResult feedback. A proposal is not a claim that execution succeeded.

## Malformed output

Complete json:patch/patch/json blocks are recognized without a complete-block regex dependency. Truncated headers, unclosed blocks, invalid JSON and multiple machine blocks invalidate the entire candidate. Known private payloads under unrelated fence labels or preceding another fence are also rejected. No partial action executes. Public prose contains a clean retry message; a `protocol_error` event and non-sensitive request-ID/status diagnostics record the failure. Stored assistant content is also clean.

Frontend `sanitizeAgentText` additionally suppresses private/truncated protocol in old stored messages, action summaries, delegated-agent notes and reasoning display paths. Empty filtered replies never claim execution success. Normal chat does not recover actions by scanning prose. This filter is a final safeguard, not the backend parser or a replacement for policy validation.

Example private model output:

    Proposta.
    ```json:patch
    {"actions":[

Public result: a clean failure/retry message and protocol_error metadata, with no patch event.

## Retry and idempotency boundary

The request ID is validated as a UUID, echoed in start/done and recorded in metadata. It remains unchanged across a pre-stream auth retry. Authentication executes before chat side effects, so the rejected 401 creates no turn. The frontend avoids executing a patch twice when both patch and done include it. This is not a persistent server idempotency ledger for arbitrary manually replayed POSTs; callers must not replay an interrupted stream.

## Regression coverage

Tests cover valid add_page through the existing router, malformed/truncated/multiple blocks, old assistant-message rendering, shared streaming auth retry, interruption without replay, and stale document-stream rejection. Existing imported-text, source-lineage, overlay and commercial-protection suites remain required.
