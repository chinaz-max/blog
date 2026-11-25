export type Game = { id: string; title: string; url: string; image: string | null; startAt: string | null; endAt: string | null; upcoming: boolean; kind: string; note: string; instructions: string; deadlineUnknown: boolean };
export type GameDataset = { fetchedAt: string; games: Game[] };
export type GamesSnapshot = { version: 1; epic?: GameDataset; steam?: GameDataset };
