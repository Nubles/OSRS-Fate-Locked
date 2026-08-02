export const guildCommands = [
  { name: 'tracker', description: 'Open the Fate Locked tracker', type: 1 },
  { name: 'runelite', description: 'Open the Fate Locked RuneLite guide', type: 1 },
  { name: 'rules', description: 'View the Fate Locked rules', type: 1 },
  { name: 'weekly-seed', description: 'Show the current Fate Locked weekly seed', type: 1 },
  { name: 'journal', description: 'Manage a run journal', type: 1, options: [{ type: 1, name: 'create', description: 'Create a run journal' }] },
  { name: 'verify', description: 'Start runner verification', type: 1 },
] as const;
