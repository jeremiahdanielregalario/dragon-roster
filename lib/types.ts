export const modes = ['overall', 'damage', 'tank', 'support', 'arena'] as const;
export type Mode = typeof modes[number];
export type Status = 'owned' | 'acquired' | 'summon';
export type Dragon = {
  id: number; name: string; slug: string; image: string; rarity: string;
  elements: string[]; category: number; family: string; summonOrbs: number;
  skills: string[]; warnings: string[]; confidence: number;
  ranks: Record<Mode, number>; scores: Record<Mode, number>;
  stats: { attack: number; life: number; move: number; speed: number; sustain: number; utility: number };
};
export type Snapshot = { fetchedAt: string; source: string; dragons: Dragon[] };
export type Rankings = Snapshot & {
  previous: Record<string, Record<Mode, number>>;
  previousAt: string | null; checkedAt: string; storage: 'cloud' | 'bundled'; warning?: string;
};
export type CollectionItem = { status: Status; acquiredAt: string | null };
export type Collection = Record<string, CollectionItem>;
export const modeNames: Record<Mode, string> = {overall: 'General', damage: 'Damage', tank: 'Tank', support: 'Support', arena: 'Arena'};
export const elementNames: Record<string, string> = {e:'Terra', f:'Flame', w:'Sea', p:'Nature', el:'Electric', i:'Ice', m:'Metal', d:'Dark', li:'Light', wr:'War', pu:'Pure', l:'Legend', pr:'Primal', wd:'Wind', ti:'Time', bt:'Beauty', ch:'Chaos', mg:'Magic', hp:'Happy', dr:'Dream', so:'Soul'};
export const rarityNames: Record<string, string> = {C:'Common', R:'Rare', V:'Very rare', E:'Epic', L:'Legendary', M:'Mythical', H:'Heroic'};
