export type GameState = {
  stockCount: number;
  waste: string[];
  foundations: {
    hearts: string[];
    diamonds: string[];
    clubs: string[];
    spades: string[];
  };
  tableau: string[][];
};

const BASE_URL = "http://127.0.0.1:8000";

export async function fetchGameState(): Promise<GameState> {
  const response = await fetch(`${BASE_URL}/game-state`);

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return response.json();
}

export async function createNewGame(): Promise<GameState> {
  const response = await fetch(`${BASE_URL}/new-game`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return response.json();
}