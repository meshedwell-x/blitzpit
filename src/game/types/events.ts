export type GameEventType =
  | 'bot:hit' | 'bot:killed' | 'bot:spawned'
  | 'player:hit' | 'player:killed'
  | 'weapon:fired' | 'weapon:botFired' | 'weapon:pickup' | 'weapon:melee'
  | 'grenade:exploded'
  | 'vehicle:roadkill' | 'vehicle:enter' | 'vehicle:exit'
  | 'zone:shrinkStart' | 'zone:playerOutside'
  | 'wave:start' | 'wave:complete' | 'wave:transition'
  | 'kill:streak'
  | 'animal:hit' | 'animal:killed'
  | 'footstep' | 'phase:change'
  | 'reinforcement:incoming';
