import { verifyAutomationRequest } from '../security/automation-signature.js';
import { parseAutomationEvent, type AutomationEvent } from '../automation.js';
import type { BotConfig } from '../types.js';

export type { AutomationEvent } from '../automation.js';

export interface AutomationDeps {
  config: BotConfig;
  handleEvent: (event: AutomationEvent) => Promise<Response>;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const parseEvent = (rawBody: string): AutomationEvent | null => {
  try {
    return parseAutomationEvent(JSON.parse(rawBody));
  } catch {
    return null;
  }
};

export const handleAutomationRequest = async (
  request: Request,
  deps: AutomationDeps,
  now = Math.floor(Date.now() / 1000),
): Promise<Response> => {
  const rawBody = await request.text();
  const timestamp = request.headers.get('x-fate-timestamp') ?? '';
  const signature = request.headers.get('x-fate-signature') ?? '';

  if (
    !verifyAutomationRequest(
      rawBody,
      timestamp,
      signature,
      deps.config.automationHmacKey,
      deps.config.allowedRepositories,
      now,
    )
  ) {
    return json({ ok: false, duplicate: false }, 401);
  }

  const event = parseEvent(rawBody);
  if (!event) return json({ ok: false, duplicate: false }, 400);

  return deps.handleEvent(event);
};
