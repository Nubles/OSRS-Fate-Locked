import {
  EventAcknowledgement,
  FateEventEnvelope,
  parseEventBatch,
} from './fateEventProtocol';
import { relaySync } from './relaySync';

class FateEventRelay {
  async fetchEvents(): Promise<FateEventEnvelope[]> {
    if (!relaySync.enabled || !relaySync.code) return [];
    try {
      const response = await fetch(
        `${relaySync.base()}/r/${relaySync.code}/events`,
        { cache: 'no-store' },
      );
      if (!response.ok) return [];
      return parseEventBatch(await response.json());
    } catch {
      return [];
    }
  }

  async acknowledge(acknowledgements: EventAcknowledgement[]): Promise<boolean> {
    if (!relaySync.enabled || acknowledgements.length === 0) return false;
    return relaySync.postOwnedSubresource('/acks', { acknowledgements });
  }
}

export const fateEventRelay = new FateEventRelay();
