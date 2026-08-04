import React, { useState } from 'react';

export type ChunkInfoIconId = 'quests' | 'combat' | 'gathering' | 'shops' | 'travel' | 'other';

export const CHUNK_INFO_OSRS_ICON_URLS: Record<ChunkInfoIconId, string> = {
  quests: 'https://oldschool.runescape.wiki/images/Quest_point_icon.png',
  combat: 'https://oldschool.runescape.wiki/images/Combat_icon.png',
  gathering: 'https://oldschool.runescape.wiki/images/Stats_icon.png',
  shops: 'https://oldschool.runescape.wiki/images/General_store_icon_(historical).png',
  travel: 'https://oldschool.runescape.wiki/images/Transportations_icon.png',
  other: 'https://oldschool.runescape.wiki/images/Collection_log_icon.png',
};

interface Props {
  id: ChunkInfoIconId;
  fallback: React.ReactNode;
}

export const ChunkInfoIcon: React.FC<Props> = ({ id, fallback }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span aria-hidden="true" data-testid={`chunk-info-icon-fallback-${id}`}>{fallback}</span>;
  }

  return (
    <img
      src={CHUNK_INFO_OSRS_ICON_URLS[id]}
      alt=""
      aria-hidden="true"
      data-testid={`chunk-info-icon-${id}`}
      className="h-4 w-4 shrink-0 object-contain [image-rendering:pixelated]"
      onError={() => setFailed(true)}
    />
  );
};
