const item = (key: string, name: string) => ({ key, name });

/** Every pickaxe accepted where a reviewed requirement or Mining recipe needs a pickaxe. */
export const usablePickaxes = [
  item('bronze pickaxe', 'Bronze pickaxe'),
  item('iron pickaxe', 'Iron pickaxe'),
  item('steel pickaxe', 'Steel pickaxe'),
  item('black pickaxe', 'Black pickaxe'),
  item('mithril pickaxe', 'Mithril pickaxe'),
  item('adamant pickaxe', 'Adamant pickaxe'),
  item('rune pickaxe', 'Rune pickaxe'),
  item('dragon pickaxe', 'Dragon pickaxe'),
  item('gilded pickaxe', 'Gilded pickaxe'),
  item('3rd age pickaxe', '3rd age pickaxe'),
  item('infernal pickaxe', 'Infernal pickaxe'),
  item('crystal pickaxe', 'Crystal pickaxe'),
];
