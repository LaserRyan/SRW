export type Card = {
  rank: string;
  suit: string;
  code: string;
  faceUp: boolean;
};

export type GameState = {
  stock: Card[];
  waste: Card[];
  foundations: {
    hearts: Card[];
    diamonds: Card[];
    clubs: Card[];
    spades: Card[];
  };
  tableau: Card[][];
};

export type GameStateResponse = {
  gameState: GameState;
  dealProgressScore: number;
};

const BASE_URL = "http://127.0.0.1:8000";

export async function fetchGameState(): Promise<GameState> {
  const response = await fetch(`${BASE_URL}/game-state`);

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data: GameStateResponse = await response.json();
  return data.gameState;
}

export async function fetchGameStateWithMeta(): Promise<GameStateResponse> {
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

  const data: GameStateResponse = await response.json();
  return data.gameState;
}

export async function createNewGameWithMeta(): Promise<GameStateResponse> {
  const response = await fetch(`${BASE_URL}/new-game`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return response.json();
}

export async function drawCards(): Promise<GameState> {
  const response = await fetch(`${BASE_URL}/draw`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data: GameStateResponse = await response.json();
  return data.gameState;
}

export async function drawCardsWithMeta(): Promise<GameStateResponse> {
  const response = await fetch(`${BASE_URL}/draw`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return response.json();
}
export async function moveWasteToTableau(tableauIndex: number): Promise<GameState> {
  const response = await fetch(`${BASE_URL}/move/waste-to-tableau`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tableauIndex }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.gameState;
}

export async function moveWasteToFoundation(foundation: string): Promise<GameState> {
  const response = await fetch(`${BASE_URL}/move/waste-to-foundation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ foundation }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.gameState;;
}

export async function moveTableauToFoundation(tableauIndex: number): Promise<GameState> {
  const response = await fetch(`${BASE_URL}/move/tableau-to-foundation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tableauIndex }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.gameState;
}

export async function moveTableauToTableau(
  fromTableauIndex: number,
  fromCardIndex: number,
  toTableauIndex: number
): Promise<GameState> {
  const response = await fetch(`${BASE_URL}/move/tableau-to-tableau`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fromTableauIndex,
      fromCardIndex,
      toTableauIndex,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.gameState;
}

export async function moveFoundationToTableau(
  foundationKey: string,
  tableauIndex: number
): Promise<GameState> {
  const response = await fetch(`${BASE_URL}/move/foundation-to-tableau`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      foundationKey,
      tableauIndex,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.gameState;
}

export type ResetGameResponse = {
  gameState: GameState;
  penaltyApplied: number;
  dealProgressScore: number;
};

export async function resetGame(): Promise<ResetGameResponse> {
  const response = await fetch(`${BASE_URL}/reset`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return response.json();
}

export async function moveWasteToTableauWithMeta(
  tableauIndex: number
): Promise<GameStateResponse> {
  const response = await fetch(`${BASE_URL}/move/waste-to-tableau`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tableauIndex }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function moveWasteToFoundationWithMeta(
  foundation: string
): Promise<GameStateResponse> {
  const response = await fetch(`${BASE_URL}/move/waste-to-foundation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ foundation }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function moveTableauToFoundationWithMeta(
  tableauIndex: number
): Promise<GameStateResponse> {
  const response = await fetch(`${BASE_URL}/move/tableau-to-foundation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tableauIndex }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function moveTableauToTableauWithMeta(
  fromTableauIndex: number,
  fromCardIndex: number,
  toTableauIndex: number
): Promise<GameStateResponse> {
  const response = await fetch(`${BASE_URL}/move/tableau-to-tableau`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fromTableauIndex,
      fromCardIndex,
      toTableauIndex,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function moveFoundationToTableauWithMeta(
  foundationKey: string,
  tableauIndex: number
): Promise<GameStateResponse> {
  const response = await fetch(`${BASE_URL}/move/foundation-to-tableau`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      foundationKey,
      tableauIndex,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}