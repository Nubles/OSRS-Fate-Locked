import { loadConfig } from '../src/config.js';
import { handleAutomationRequest } from '../src/handlers/automation.js';

const config = loadConfig(process.env);

export default async function automation(request: Request): Promise<Response> {
  return handleAutomationRequest(request, {
    config,
    handleEvent: async () =>
      new Response(JSON.stringify({ error: 'Automation workflows are not available yet.' }), {
        status: 501,
        headers: { 'content-type': 'application/json' },
      }),
  });
}
