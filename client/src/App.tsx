import { useEffect, useState } from "react";
import type { GameState, Card } from "./api/gameApi";
import "./App.css";

type SelectedTableauMove = {
  tableauIndex: number;
  cardIndex: number;
};

type SelectedFoundationMove = {
  foundationKey: string;
};

type Screen = "start" | "lobby" | "game" | "results";

type MatchStats = {
  matchStartMs: number | null;
  dealStartMs: number | null;
  overallElapsedMs: number;
  dealElapsedMs: number;
  accumulatedPenaltyMs: number;
  resetCount: number;
  totalMoveCount: number;
  dealMoveCount: number;
};

type CreateMatchResponse = {
  matchId: string;
  playerId: string;
  gameState: GameState;
  dealProgressScore: number;
  error?: string;
};



const TABLEAU_KEY_TO_INDEX: Record<string, number> = {
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
  "6": 5,
  "7": 6,
};

const FOUNDATION_KEY_TO_KEY: Record<string, string> = {
  q: "hearts",
  w: "diamonds",
  e: "clubs",
  r: "spades",
};

const createInitialMatchStats = (): MatchStats => ({
  matchStartMs: null,
  dealStartMs: null,
  overallElapsedMs: 0,
  dealElapsedMs: 0,
  accumulatedPenaltyMs: 0,
  resetCount: 0,
  totalMoveCount: 0,
  dealMoveCount: 0,
});

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
};

function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dealProgressScore, setDealProgressScore] = useState(0);
  const [matchStats, setMatchStats] = useState<MatchStats>(createInitialMatchStats());

  const [selectedTableauMove, setSelectedTableauMove] =
    useState<SelectedTableauMove | null>(null);

  const [selectedFoundationMove, setSelectedFoundationMove] =
    useState<SelectedFoundationMove | null>(null);

  const [hoveredTableauIndex, setHoveredTableauIndex] = useState<number | null>(null);
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);

  const [isProcessingMove, setIsProcessingMove] = useState(false);

  const [lobbyPlayerCount, setLobbyPlayerCount] = useState(0);
  const [lobbyReadyCount, setLobbyReadyCount] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [matchSummary, setMatchSummary] = useState<any>(null);
  const [joinMatchId, setJoinMatchId] = useState("");


  const [matchId, setMatchId] = useState<string | null>(
    localStorage.getItem("matchId")
  );

  const [playerId, setPlayerId] = useState<string | null>(
    localStorage.getItem("playerId")
  );

  const saveMatchIdentity = (
    newMatchId: string,
    newPlayerId: string
  ) => {
    localStorage.setItem("matchId", newMatchId);
    localStorage.setItem("playerId", newPlayerId);

    setMatchId(newMatchId);
    setPlayerId(newPlayerId);
  };

  const clearMatchIdentity = () => {
    localStorage.removeItem("matchId");
    localStorage.removeItem("playerId");

    setMatchId(null);
    setPlayerId(null);
  };

  const getHoveredTableauCard = () => {
    if (
      !gameState ||
      hoveredTableauIndex === null ||
      hoveredCardIndex === null
    ) {
      return null;
    }

    const pile = gameState.tableau[hoveredTableauIndex];

    if (!pile || hoveredCardIndex < 0 || hoveredCardIndex >= pile.length) {
      return null;
    }

    const card = pile[hoveredCardIndex];

    if (!card.faceUp) {
      return null;
    }

    return {
      tableauIndex: hoveredTableauIndex,
      cardIndex: hoveredCardIndex,
      pile,
      card,
      isTopCard: hoveredCardIndex === pile.length - 1,
    };
  };

  const getHoveredTableauColumn = () => {
    if (!gameState || hoveredTableauIndex === null) {
      return null;
    }

    return {
      tableauIndex: hoveredTableauIndex,
      pile: gameState.tableau[hoveredTableauIndex],
    };
  };

  const getActiveTableauSource = () => {
    const hoveredCard = getHoveredTableauCard();

    if (hoveredCard) {
      return {
        tableauIndex: hoveredCard.tableauIndex,
        cardIndex: hoveredCard.cardIndex,
        isTopCard: hoveredCard.isTopCard,
        from: "hover" as const,
      };
    }

    if (selectedTableauMove) {
      const pile = gameState?.tableau[selectedTableauMove.tableauIndex];

      if (
        pile &&
        selectedTableauMove.cardIndex >= 0 &&
        selectedTableauMove.cardIndex < pile.length &&
        pile[selectedTableauMove.cardIndex]?.faceUp
      ) {
        return {
          tableauIndex: selectedTableauMove.tableauIndex,
          cardIndex: selectedTableauMove.cardIndex,
          isTopCard: selectedTableauMove.cardIndex === pile.length - 1,
          from: "selected" as const,
        };
      }
    }

    return null;
  };

    const getActiveTableauCard = () => {
      const activeTableauSource = getActiveTableauSource();

      if (!gameState || !activeTableauSource) {
        return null;
      }

      const pile = gameState.tableau[activeTableauSource.tableauIndex];

      if (
        !pile ||
        activeTableauSource.cardIndex < 0 ||
        activeTableauSource.cardIndex >= pile.length
      ) {
        return null;
      }

      return pile[activeTableauSource.cardIndex];
    };

  

  

  const refreshHoveredCardForColumn = (
    nextGameState: GameState,
    tableauIndex: number | null
  ) => {
    if (tableauIndex === null) {
      setHoveredCardIndex(null);
      return;
    }

    const pile = nextGameState.tableau[tableauIndex];

    if (!pile || pile.length === 0) {
      setHoveredCardIndex(null);
      return;
    }

    for (let i = pile.length - 1; i >= 0; i--) {
      if (pile[i].faceUp) {
        setHoveredCardIndex(i);
        return;
      }
    }

    setHoveredCardIndex(null);
  };

const finishCurrentPlayer = async () => {
  if (!matchId || !playerId) {
    return;
  }

  const elapsedTimeSeconds =
    matchStats.matchStartMs !== null
      ? (Date.now() - matchStats.matchStartMs) / 1000
      : matchStats.overallElapsedMs / 1000;

  try {
    await fetch(
      `http://127.0.0.1:8000/matches/${matchId}/players/${playerId}/finish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          elapsedTime: elapsedTimeSeconds,
        }),
      }
    );
  } catch {
    // Ignore finish errors for now.
  }
};

const loadMatchSummary = async () => {
  if (!matchId) {
    return;
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:8000/matches/${matchId}/summary`
    );

    const data = await response.json();

    if (!data.error) {
      setMatchSummary(data);
    }
  } catch {
    // Ignore for now.
  }
};

  const getFoundationCardCount = (state: GameState) => {
    return (
      state.foundations.hearts.length +
      state.foundations.diamonds.length +
      state.foundations.clubs.length +
      state.foundations.spades.length
    );
  };

  const applyGameStateUpdate = async (
    data: GameState,
    nextDealProgressScore?: number
  ) => {
    setGameState(data);

    if (typeof nextDealProgressScore === "number") {
      setDealProgressScore(nextDealProgressScore);
    }

    refreshHoveredCardForColumn(data, hoveredTableauIndex);
    setSelectedTableauMove(null);
    setSelectedFoundationMove(null);

    if (getFoundationCardCount(data) === 52) {
      await finishCurrentPlayer();
      await loadMatchSummary();
      setScreen("results");
    }
  };

  const recordSuccessfulAction = () => {
  setMatchStats((prev) => ({
    ...prev,
    totalMoveCount: prev.totalMoveCount + 1,
    dealMoveCount: prev.dealMoveCount + 1,
  }));
};

  const runLockedMove = async (
    action: () => Promise<GameState>,
    options?: {
      clearTableauSelectionOnError?: boolean;
      clearFoundationSelectionOnError?: boolean;
    }
  ) => {
    if (isProcessingMove) {
      return;
    }

    try {
      setIsProcessingMove(true);
      setError(null);

      const data = await action();
      applyGameStateUpdate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");

      if (options?.clearTableauSelectionOnError) {
        setSelectedTableauMove(null);
      }

      if (options?.clearFoundationSelectionOnError) {
        setSelectedFoundationMove(null);
      }
    } finally {
      setIsProcessingMove(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      const isHandledKey =
        key === " " ||
        key === "escape" ||
        key in TABLEAU_KEY_TO_INDEX ||
        key in FOUNDATION_KEY_TO_KEY;

      if (!isHandledKey) {
        return;
      }

      event.preventDefault();

      if (loading || !gameState || isProcessingMove) {
        return;
      }

      if (event.repeat) {
        return;
      }

      if (key === "escape") {
        setSelectedTableauMove(null);
        setSelectedFoundationMove(null);
        setError(null);
        return;
      }

      if (key === " ") {
        void handleDraw();
        return;
      }

      if (key in TABLEAU_KEY_TO_INDEX) {
        const toTableauIndex = TABLEAU_KEY_TO_INDEX[key];
        const activeTableauSource = getActiveTableauSource();

        if (activeTableauSource) {
          await runLockedMove(
            async () => {
              if (!matchId || !playerId) {
                setError("Missing match or player id");
                return;
              }
              
              const response = await fetch(
                `http://127.0.0.1:8000/matches/${matchId}/players/${playerId}/move/tableau-to-tableau`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    fromTableauIndex: activeTableauSource.tableauIndex,
                    fromCardIndex: activeTableauSource.cardIndex,
                    toTableauIndex,
                  }),
                }
              ).then((res) => res.json());

              if (response.error) {
                throw new Error(response.error);
              }
              setDealProgressScore(response.dealProgressScore);
              return response.gameState;
            },
            { clearTableauSelectionOnError: true }
          );

          return;
        }

        void handleWasteToTableau(toTableauIndex);
        return;
      }

      if (key in FOUNDATION_KEY_TO_KEY) {
        const foundationKey = FOUNDATION_KEY_TO_KEY[key];
        const activeTableauSource = getActiveTableauSource();

        if (event.shiftKey) {
          const hoveredColumn = getHoveredTableauColumn();

          if (!hoveredColumn) {
            return;
          }

          await runLockedMove(async () => {
            const response = await fetch(
              `http://127.0.0.1:8000/matches/${matchId}/players/${playerId}/move/foundation-to-tableau`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  foundationKey,
                  tableauIndex: hoveredColumn.tableauIndex,
                }),
              }
            ).then((res) => res.json());

            if (response.error) {
              throw new Error(response.error);
            }
            setDealProgressScore(response.dealProgressScore);
            return response.gameState;
          });

          return;
        }

        if (activeTableauSource?.isTopCard) {
          const activeCard = getActiveTableauCard();

          const suitToFoundationKey: Record<string, string> = {
            H: "hearts",
            D: "diamonds",
            C: "clubs",
            S: "spades",
          };

          if (
            activeCard &&
            suitToFoundationKey[activeCard.suit] === foundationKey
          ) {
            void handleTableauToFoundation(activeTableauSource.tableauIndex);
          }

          return;
        }

        void handleWasteToFoundation(foundationKey);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    loading,
    gameState,
    hoveredTableauIndex,
    hoveredCardIndex,
    selectedTableauMove,
    selectedFoundationMove,
    isProcessingMove,
  ]);


  useEffect(() => {
    const restoreSavedMatch = async () => {
      if (!matchId || !playerId) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const matchResponse = await fetch(
          `http://127.0.0.1:8000/matches/${matchId}`
        );

        const matchData = await matchResponse.json();

        if (matchData.error) {
          clearMatchIdentity();
          setScreen("start");
          return;
        }

        if (matchData.status === "lobby") {
          setScreen("lobby");
          return;
        }

        if (matchData.status === "playing") {
          await loadCurrentPlayerState();
          setScreen("game");
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    restoreSavedMatch();
  }, []);

  useEffect(() => {
    if (screen !== "lobby" || !matchId || !playerId) {
      return;
    }

    const checkMatchStatus = async () => {
      const response = await fetch(
        `http://127.0.0.1:8000/matches/${matchId}`
      );

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setLobbyPlayerCount(data.playerCount);
      setLobbyReadyCount(data.readyPlayerCount);

      if (data.status === "countdown" && data.scheduledStartTime) {
        const secondsLeft = Math.max(
          0,
          Math.ceil(data.scheduledStartTime - Date.now() / 1000)
        );

        setCountdownSeconds(secondsLeft);
      }

      if (data.status === "playing") {
        const officialStartMs = data.scheduledStartTime
          ? data.scheduledStartTime * 1000
          : Date.now();

        setMatchStats({
          matchStartMs: officialStartMs,
          dealStartMs: officialStartMs,
          overallElapsedMs: 0,
          dealElapsedMs: 0,
          accumulatedPenaltyMs: 0,
          resetCount: 0,
          totalMoveCount: 0,
          dealMoveCount: 0,
        });

        await loadCurrentPlayerState();
        setScreen("game");
      }
    };

    checkMatchStatus();

    const intervalId = window.setInterval(checkMatchStatus, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [screen, matchId, playerId]);

  useEffect(() => {
    if (screen !== "game") {
      return;
    }

    const intervalId = window.setInterval(() => {
      const now = Date.now();

      setMatchStats((prev) => ({
        ...prev,
        overallElapsedMs:
          prev.matchStartMs !== null ? now - prev.matchStartMs : prev.overallElapsedMs,
        dealElapsedMs:
          prev.dealStartMs !== null ? now - prev.dealStartMs : prev.dealElapsedMs,
      }));
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [screen]);

const loadCurrentPlayerState = async () => {
  if (!matchId || !playerId) {
    setError("Missing match or player id");
    return;
  }

  try {
    setLoading(true);
    setError(null);

    const response = await fetch(
      `http://127.0.0.1:8000/matches/${matchId}/players/${playerId}/game-state`
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    applyGameStateUpdate(data.gameState, data.dealProgressScore);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unknown error");
  } finally {
    setLoading(false);
  }
};

const handleNewGame = async () => {
  if (isProcessingMove) {
    return;
  }

  try {
    setIsProcessingMove(true);
    setLoading(true);
    setError(null);
    setIsReady(false);
    setCountdownSeconds(null);
    setLobbyPlayerCount(1);
    setLobbyReadyCount(0);

    const response = await fetch("http://127.0.0.1:8000/matches", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        playerId: "player-1",
      }),
    });

    const data: CreateMatchResponse = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    saveMatchIdentity(data.matchId, data.playerId);

    // const startResponse = await fetch(
    //   `http://127.0.0.1:8000/matches/${data.matchId}/start`,
    //   {
    //     method: "POST",
    //   }
    // );

    // const startData = await startResponse.json();

    // if (startData.error) {
    //   throw new Error(startData.error);
    // }

    const now = Date.now();

    setMatchStats({
      matchStartMs: now,
      dealStartMs: now,
      overallElapsedMs: 0,
      dealElapsedMs: 0,
      accumulatedPenaltyMs: 0,
      resetCount: 0,
      totalMoveCount: 0,
      dealMoveCount: 0,
    });

    applyGameStateUpdate(data.gameState, data.dealProgressScore);
    setScreen("lobby");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unknown error");
  } finally {
    setLoading(false);
    setIsProcessingMove(false);
  }
};

const handleJoinMatch = async () => {
  if (isProcessingMove) {
    return;
  }

  const trimmedMatchId = joinMatchId.trim();

  if (!trimmedMatchId) {
    setError("Enter a match ID first");
    return;
  }

  const newPlayerId = `player-${Date.now()}`;

  try {
    setIsProcessingMove(true);
    setLoading(true);
    setError(null);
    setIsReady(false);
    setCountdownSeconds(null);

    const response = await fetch(
      `http://127.0.0.1:8000/matches/${trimmedMatchId}/players/${newPlayerId}`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    saveMatchIdentity(data.matchId, data.playerId);
    applyGameStateUpdate(data.gameState, data.dealProgressScore);
    setScreen("lobby");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unknown error");
  } finally {
    setLoading(false);
    setIsProcessingMove(false);
  }
};

const handleReadyUp = async () => {
  if (isProcessingMove) {
    return;
  }

  if (!matchId || !playerId) {
    setError("Missing match or player id");
    return;
  }

  try {
    setIsProcessingMove(true);
    setLoading(true);
    setError(null);

    const response = await fetch(
      `http://127.0.0.1:8000/matches/${matchId}/players/${playerId}/ready`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    setIsReady(true);
    setLobbyPlayerCount(data.playerCount);
    setLobbyReadyCount(data.readyPlayerCount);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unknown error");
  } finally {
    setLoading(false);
    setIsProcessingMove(false);
  }
};

const handleResetGame = async () => {
  if (isProcessingMove) {
    return;
  }

  try {
    setIsProcessingMove(true);
    setError(null);

    const response = await fetch(
      `http://127.0.0.1:8000/matches/${matchId}/players/${playerId}/reset`,
      {
        method: "POST",
      }
    ).then((res) => res.json());

    if (response.error) {
      throw new Error(response.error);
    }
    const now = Date.now();

    setMatchStats((prev) => ({
      ...prev,
      dealStartMs: now,
      dealElapsedMs: 0,
      accumulatedPenaltyMs: prev.accumulatedPenaltyMs + response.penaltyApplied * 1000,
      resetCount: prev.resetCount + 1,
      dealMoveCount: 0,
    }));

    applyGameStateUpdate(response.gameState, response.dealProgressScore);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unknown error");
  } finally {
    setIsProcessingMove(false);
  }
};

const handleLeaveGame = async () => {
  if (isProcessingMove) {
    return;
  }

  if (matchId && playerId) {
    try {
      await fetch(
        `http://127.0.0.1:8000/matches/${matchId}/players/${playerId}/quit`,
        {
          method: "POST",
        }
      );
    } catch {
      // Ignore backend errors while leaving.
    }
  }

  setScreen("start");
  setGameState(null);
  setError(null);
  setLoading(false);
  setMatchStats(createInitialMatchStats());
  setDealProgressScore(0);
  setLobbyPlayerCount(0);
  setLobbyReadyCount(0);
  setIsReady(false);
  setCountdownSeconds(null);
  setJoinMatchId("");
  setSelectedTableauMove(null);
  setSelectedFoundationMove(null);
  setHoveredTableauIndex(null);
  setHoveredCardIndex(null);
  clearMatchIdentity();
};

  const handleWasteToTableau = async (tableauIndex: number) => {
    if (isProcessingMove) {
      return;
    }
    if (!matchId || !playerId) {
      setError("Missing match or player id");
      return;
    }

    try {
      setIsProcessingMove(true);
      setError(null);

      const response = await fetch(
        `http://127.0.0.1:8000/matches/${matchId}/players/${playerId}/move/waste-to-tableau`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tableauIndex,
          }),
        }
      ).then((res) => res.json());
      if (response.error) {
        throw new Error(response.error);
      }
      recordSuccessfulAction();
      applyGameStateUpdate(response.gameState, response.dealProgressScore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsProcessingMove(false);
    }
  };

  const handleWasteToFoundation = async (foundation: string) => {
    if (isProcessingMove) {
      return;
    }

    if (!matchId || !playerId) {
      setError("Missing match or player id");
      return;
    }

    try {
      setIsProcessingMove(true);
      setError(null);

      const response = await fetch(
        `http://127.0.0.1:8000/matches/${matchId}/players/${playerId}/move/waste-to-foundation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            foundation,
          }),
        }
      ).then((res) => res.json());
      if (response.error) {
        throw new Error(response.error);
      }
      recordSuccessfulAction();
      applyGameStateUpdate(response.gameState, response.dealProgressScore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsProcessingMove(false);
    }
  };

  const handleTableauToFoundation = async (tableauIndex: number) => {
    if (isProcessingMove) {
      return;
    }

    if (!matchId || !playerId) {
      setError("Missing match or player id");
      return;
    }
    try {
      setIsProcessingMove(true);
      setError(null);

      const response = await fetch(
        `http://127.0.0.1:8000/matches/${matchId}/players/${playerId}/move/tableau-to-foundation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tableauIndex,
          }),
        }
      ).then((res) => res.json());

      if (response.error) {
        throw new Error(response.error);
      }
      recordSuccessfulAction();
      applyGameStateUpdate(response.gameState, response.dealProgressScore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsProcessingMove(false);
    }
  };

  const handleTableauToTableau = async (toTableauIndex: number) => {
    if (!selectedTableauMove || isProcessingMove) {
      return;
    }

    if (!matchId || !playerId) {
      setError("Missing match or player id");
      return;
    }

    try {
      setIsProcessingMove(true);
      setError(null);

      const response = await fetch(
        `http://127.0.0.1:8000/matches/${matchId}/players/${playerId}/move/tableau-to-tableau`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fromTableauIndex: selectedTableauMove.tableauIndex,
            fromCardIndex: selectedTableauMove.cardIndex,
            toTableauIndex,
          }),
        }
      ).then((res) => res.json());

      if (response.error) {
        throw new Error(response.error);
      }

      recordSuccessfulAction();
      applyGameStateUpdate(response.gameState, response.dealProgressScore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSelectedTableauMove(null);
    } finally {
      setIsProcessingMove(false);
    }
  };

  const handleSelectTableauCard = (
    tableauIndex: number,
    cardIndex: number,
    isTopCard: boolean,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();

    if (event.shiftKey && isTopCard) {
      void handleTableauToFoundation(tableauIndex);
      return;
    }

    setError(null);
    setSelectedTableauMove({
      tableauIndex,
      cardIndex,
    });
  };

  const handleSelectFoundation = (foundationKey: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setError(null);
    setSelectedTableauMove(null);
    setSelectedFoundationMove({ foundationKey });
  };

  const handleFoundationToTableau = async (tableauIndex: number) => {
    if (!selectedFoundationMove || isProcessingMove) {
      return;
    }

    if (!matchId || !playerId) {
      setError("Missing match or player id");
      return;
    }

    try {
      setIsProcessingMove(true);
      setError(null);

      const response = await fetch(
        `http://127.0.0.1:8000/matches/${matchId}/players/${playerId}/move/foundation-to-tableau`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            foundationKey: selectedFoundationMove.foundationKey,
            tableauIndex,
          }),
        }
      ).then((res) => res.json());

      if (response.error) {
        throw new Error(response.error);
      }

      recordSuccessfulAction();
      applyGameStateUpdate(response.gameState, response.dealProgressScore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSelectedFoundationMove(null);
    } finally {
      setIsProcessingMove(false);
    }
  };

  const handleTableauColumnMouseEnter = (tableauIndex: number) => {
    setHoveredTableauIndex(tableauIndex);
    setHoveredCardIndex(null);
  };

  const handleTableauColumnMouseLeave = () => {
    setHoveredTableauIndex(null);
    setHoveredCardIndex(null);
  };

  const handleTableauCardMouseEnter = (
    tableauIndex: number,
    cardIndex: number,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    setHoveredTableauIndex(tableauIndex);
    setHoveredCardIndex(cardIndex);
  };

  const getSuitSymbol = (suit: string) => {
    switch (suit) {
      case "H":
        return "♥";
      case "D":
        return "♦";
      case "C":
        return "♣";
      case "S":
        return "♠";
      default:
        return "?";
    }
  };

  const getSuitClass = (suit: string) => {
    return suit === "H" || suit === "D" ? "red" : "black";
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);

    return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
  };

  const renderCard = (card: Card, key: string) => {
    const isFaceDown = !card.faceUp;

    return (
      <div
        key={key}
        className={`card ${isFaceDown ? "face-down" : "face-up"}`}
      >
        {!isFaceDown && (
          <div className={`card-corner ${getSuitClass(card.suit)}`}>
            <div className="card-rank">{card.rank}</div>
            <div className="card-suit">{getSuitSymbol(card.suit)}</div>
          </div>
        )}
      </div>
    );
  };

  const handleDraw = async () => {
    if (isProcessingMove) {
      return;
    }

    if (!matchId || !playerId) {
      setError("Missing match or player id");
      return;
    }

    try {
      setIsProcessingMove(true);
      setError(null);

      const response = await fetch(
        `http://127.0.0.1:8000/matches/${matchId}/players/${playerId}/draw`,
        {
          method: "POST",
        }
      ).then((res) => res.json());

      if (response.error) {
        throw new Error(response.error);
      }

      recordSuccessfulAction();
      applyGameStateUpdate(response.gameState, response.dealProgressScore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsProcessingMove(false);
    }
  };

  const finalTimeMs =
    matchStats.overallElapsedMs + matchStats.accumulatedPenaltyMs;

  

// 👇 ADD THIS BLOCK RIGHT HERE
if (screen === "start") {
  return (
    <div className="app start-screen">
      <div className="start-screen-content">
        <h1 className="title">Solitaire Race</h1>
        <p className="start-screen-subtitle">
          Multiplayer Klondike race. Same seed, fastest solve wins.
        </p>

        {error && <p className="error">Failed to start game: {error}</p>}

        <button
          className="new-game-button"
          onClick={handleNewGame}
          disabled={isProcessingMove || loading}
        >
          {loading ? "Starting..." : "Start Game"}
        </button>
        <input
          value={joinMatchId}
          onChange={(e) => setJoinMatchId(e.target.value)}
          placeholder="Enter Match ID"
          disabled={isProcessingMove || loading}
        />

        <button
          className="new-game-button"
          onClick={handleJoinMatch}
          disabled={isProcessingMove || loading}
        >
          Join Match
        </button>
      </div>
    </div>
  );
}

if (screen === "lobby") {
  return (
    <div className="app start-screen">
      <div className="start-screen-content">
        <h1 className="title">Match Lobby</h1>

        <p className="start-screen-subtitle">
          Share this Match ID with another player:
        </p>

        <div className="results-stats">
          <div className="results-stat-row">
            <span>Room Code</span>
            <strong>{matchId}</strong>
          </div>

          <div className="results-stat-row">
            <span>Players</span>
            <strong>{lobbyPlayerCount || "?"}</strong>
          </div>

          <div className="results-stat-row">
            <span>Ready</span>
            <strong>
              {lobbyReadyCount} / {lobbyPlayerCount || "?"}
            </strong>
          </div>
        </div>
        {lobbyPlayerCount < 2 && (
          <p className="start-screen-subtitle">
            Waiting for another player to join...
          </p>
        )}
        {countdownSeconds !== null && (
          <h2>Starting in {countdownSeconds}</h2>
        )}

        {countdownSeconds === null && (
          <button
            className="new-game-button"
            onClick={handleReadyUp}
            disabled={loading || isProcessingMove || isReady || lobbyPlayerCount < 2}
          >
            {isReady ? "Ready!" : "Ready Up"}
          </button>
        )}

        {countdownSeconds === null && (
          <button
            className="leave-game-button"
            onClick={handleLeaveGame}
            disabled={loading || isProcessingMove}
          >
            Leave Lobby
          </button>
        )}
      </div>
    </div>
  );
}

if (screen === "results") {
  return (
    <div className="app start-screen">
      <div className="start-screen-content results-screen-content">
        <h1 className="title">You Win</h1>
        <p className="start-screen-subtitle">
          All 52 cards are in the foundations.
        </p>

        <div className="results-stats">
          <div className="results-stat-row">
            <span>Total Time</span>
            <strong>{formatTime(finalTimeMs)}</strong>
          </div>

          <div className="results-stat-row">
            <span>Overall Time</span>
            <strong>{formatTime(matchStats.overallElapsedMs)}</strong>
          </div>

          <div className="results-stat-row">
            <span>Penalty Time</span>
            <strong>{formatTime(matchStats.accumulatedPenaltyMs)}</strong>
          </div>

          <div className="results-stat-row">
            <span>Winning Deal Time</span>
            <strong>{formatTime(matchStats.dealElapsedMs)}</strong>
          </div>

          <div className="results-stat-row">
            <span>Resets</span>
            <strong>{matchStats.resetCount}</strong>
          </div>

          <div className="results-stat-row">
            <span>Total Moves</span>
            <strong>{matchStats.totalMoveCount}</strong>
          </div>
        </div>

        <button
          className="new-game-button"
          onClick={handleLeaveGame}
          disabled={isProcessingMove}
        >
          Return to Start
        </button>
      </div>
    </div>
  );
}

// 👇 THIS IS YOUR ORIGINAL RETURN (DO NOT MODIFY)
return (
  <div className="app">
    <div className="header-row">
        <div className="header-left">
          <h1 className="title">Solitaire Race</h1>
          <div className="status-text">
            {isProcessingMove ? "Processing move..." : "Ready"} | Overall:{" "}
            {(matchStats.overallElapsedMs / 1000).toFixed(1)}s | Deal:{" "}
            {(matchStats.dealElapsedMs / 1000).toFixed(1)}s | Penalty:{" "}
            {(matchStats.accumulatedPenaltyMs / 1000).toFixed(1)}s | Resets:{" "}
            {matchStats.resetCount} | Moves: {matchStats.totalMoveCount} | Score:{" "}
            {dealProgressScore}
          </div>
          {matchId && (
            <div className="status-text">
              Match ID: {matchId}
            </div>
          )}
        </div>

        <div className="header-actions">
          <button
            className="new-game-button"
            onClick={handleResetGame}
            disabled={isProcessingMove}
          >
            Reset Game
          </button>

          <button
            className="leave-game-button"
            onClick={handleLeaveGame}
            disabled={isProcessingMove}
          >
            Leave Game
          </button>
        </div>
      </div>

      <p style={{ marginTop: 0, marginBottom: 16 }}>
        Click a face-up tableau card to select a stack, then click a tableau column to move it there. Click a non-empty foundation to select it, then click a tableau column for foundation → tableau. If no source is selected, clicking a tableau column tries waste → tableau. Shift + click a top tableau card for tableau → foundation.
      </p>

      {loading && <p>Loading game state...</p>}

      {error && <p className="error">Failed to load game state: {error}</p>}

      {gameState && (
        <div className="board">

          <div className="top-row">
            <div className="top-group">
              <div className="pile-area">
                <div className="pile-label">Stock</div>
                <div className="pile-slot" onClick={handleDraw} style={{ cursor: "pointer" }}>
                  {gameState.stock.length > 0 ? (
                    <div className="card face-down"></div>
                  ) : (
                    <div className="empty-slot">Recycle</div>
                  )}
                </div>
                <div className="pile-count">{gameState.stock.length} cards</div>
              </div>

              <div className="pile-area">
                <div className="pile-label">Waste</div>
                <div className="pile-slot">
                  {gameState.waste.length > 0 ? (
                    <div className="waste-stack">
                      {gameState.waste
                        .slice(-3)
                        .map((card, index) => (
                          <div
                            className={`waste-card waste-pos-${index}`}
                            key={`waste-${gameState.waste.length - 3 + index}-${card.code}`}
                          >
                            {renderCard(card, `waste-card-${index}`)}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="empty-slot">Empty</div>
                  )}
                </div>
              </div>
            </div>

            <div className="top-group foundations">
              <div
                className={`pile-area ${
                  selectedFoundationMove?.foundationKey === "hearts" ? "selected-foundation" : ""
                }`}
                onClick={(e) => {
                  if (gameState.foundations.hearts.length > 0) {
                    handleSelectFoundation("hearts", e);
                  } else {
                    void handleWasteToFoundation("hearts");
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="pile-label">Hearts</div>
                <div className="pile-slot">
                  {gameState.foundations.hearts.length > 0 ? (
                    renderCard(
                      gameState.foundations.hearts[
                        gameState.foundations.hearts.length - 1
                      ],
                      "hearts-top"
                    )
                  ) : (
                    <div className="empty-slot">Empty</div>
                  )}
                </div>
              </div>

              <div
                className={`pile-area ${
                  selectedFoundationMove?.foundationKey === "diamonds" ? "selected-foundation" : ""
                }`}
                onClick={(e) => {
                  if (gameState.foundations.diamonds.length > 0) {
                    handleSelectFoundation("diamonds", e);
                  } else {
                    void handleWasteToFoundation("diamonds");
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="pile-label">Diamonds</div>
                <div className="pile-slot">
                  {gameState.foundations.diamonds.length > 0 ? (
                    renderCard(
                      gameState.foundations.diamonds[
                        gameState.foundations.diamonds.length - 1
                      ],
                      "diamonds-top"
                    )
                  ) : (
                    <div className="empty-slot">Empty</div>
                  )}
                </div>
              </div>

              <div
                className={`pile-area ${
                  selectedFoundationMove?.foundationKey === "clubs" ? "selected-foundation" : ""
                }`}
                onClick={(e) => {
                  if (gameState.foundations.clubs.length > 0) {
                    handleSelectFoundation("clubs", e);
                  } else {
                    void handleWasteToFoundation("clubs");
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="pile-label">Clubs</div>
                <div className="pile-slot">
                  {gameState.foundations.clubs.length > 0 ? (
                    renderCard(
                      gameState.foundations.clubs[
                        gameState.foundations.clubs.length - 1
                      ],
                      "clubs-top"
                    )
                  ) : (
                    <div className="empty-slot">Empty</div>
                  )}
                </div>
              </div>

              <div
                className={`pile-area ${
                  selectedFoundationMove?.foundationKey === "spades" ? "selected-foundation" : ""
                }`}
                onClick={(e) => {
                  if (gameState.foundations.spades.length > 0) {
                    handleSelectFoundation("spades", e);
                  } else {
                    void handleWasteToFoundation("spades");
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="pile-label">Spades</div>
                <div className="pile-slot">
                  {gameState.foundations.spades.length > 0 ? (
                    renderCard(
                      gameState.foundations.spades[
                        gameState.foundations.spades.length - 1
                      ],
                      "spades-top"
                    )
                  ) : (
                    <div className="empty-slot">Empty</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="tableau-row">
            {gameState.tableau.map((pile, pileIndex) => {
              return (
                <div
                  className={`tableau-column ${
                    hoveredTableauIndex === pileIndex ? "hovered-column" : ""
                  }`}
                  key={`pile-${pileIndex}`}
                  onMouseEnter={() => handleTableauColumnMouseEnter(pileIndex)}
                  onMouseLeave={handleTableauColumnMouseLeave}
                  onClick={() => {
                    if (selectedTableauMove) {
                      void handleTableauToTableau(pileIndex);
                    } else if (selectedFoundationMove) {
                      void handleFoundationToTableau(pileIndex);
                    } else {
                      void handleWasteToTableau(pileIndex);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div className="pile-label">T{pileIndex + 1}</div>

                  <div className="tableau-stack">
                    {pile.length === 0 ? (
                      <div className="empty-tableau-slot">Empty</div>
                    ) : (
                      pile.map((card, cardIndex) => {
                        const isFaceUp = card.faceUp;
                        const isTopCard = cardIndex === pile.length - 1 && isFaceUp;

                        const isSelected =
                          selectedTableauMove?.tableauIndex === pileIndex &&
                          selectedTableauMove?.cardIndex === cardIndex;

                        return (
                          <div
                            className={`tableau-card-wrapper 
                              ${isSelected ? "selected-card" : ""} 
                              ${
                                hoveredTableauIndex === pileIndex &&
                                hoveredCardIndex === cardIndex
                                  ? "hovered-card"
                                  : ""
                              }`}
                            key={`pile-${pileIndex}-card-${cardIndex}`}
                            onMouseEnter={
                              isFaceUp
                                ? (e) => handleTableauCardMouseEnter(pileIndex, cardIndex, e)
                                : undefined
                            }
                            onClick={
                              isFaceUp
                                ? (e) =>
                                    handleSelectTableauCard(
                                      pileIndex,
                                      cardIndex,
                                      isTopCard,
                                      e
                                    )
                                : undefined
                            }
                            style={isFaceUp ? { cursor: "pointer" } : undefined}
                          >
                            {renderCard(
                              card,
                              `pile-${pileIndex}-card-${cardIndex}-inner`
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
