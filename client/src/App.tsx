import { useEffect, useState } from "react";
import { createNewGame, fetchGameState } from "./api/gameApi";
import type { GameState } from "./api/gameApi";
import "./App.css";

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGameState = async () => {
      try {
        const data = await fetchGameState();
        setGameState(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    loadGameState();
  }, []);

    const handleNewGame = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await createNewGame();
      setGameState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const renderCard = (card: string, key: string) => {
    const isFaceDown = card === "XX";

    return (
      <div
        key={key}
        className={`card ${isFaceDown ? "face-down" : "face-up"}`}
      >
        {isFaceDown ? "" : card}
      </div>
    );
  };

  return (
    <div className="app">
            <div className="header-row">
        <h1 className="title">Solitaire Race</h1>
        <button className="new-game-button" onClick={handleNewGame}>
          New Game
        </button>
      </div>

      {loading && <p>Loading game state...</p>}

      {error && <p className="error">Failed to load game state: {error}</p>}

      {gameState && (
        <div className="board">
          <div className="top-row">
            <div className="top-group">
              <div className="pile-area">
                <div className="pile-label">Stock</div>
                <div className="pile-slot">
                  {gameState.stockCount > 0 ? (
                    <div className="card face-down"></div>
                  ) : (
                    <div className="empty-slot">Empty</div>
                  )}
                </div>
                <div className="pile-count">{gameState.stockCount} cards</div>
              </div>

              <div className="pile-area">
                <div className="pile-label">Waste</div>
                <div className="pile-slot">
                  {gameState.waste.length > 0 ? (
                    renderCard(
                      gameState.waste[gameState.waste.length - 1],
                      "waste-top"
                    )
                  ) : (
                    <div className="empty-slot">Empty</div>
                  )}
                </div>
              </div>
            </div>

            <div className="top-group foundations">
              <div className="pile-area">
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

              <div className="pile-area">
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

              <div className="pile-area">
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

              <div className="pile-area">
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
            {gameState.tableau.map((pile, pileIndex) => (
              <div className="tableau-column" key={`pile-${pileIndex}`}>
                <div className="pile-label">T{pileIndex + 1}</div>

                <div className="tableau-stack">
                  {pile.map((card, cardIndex) => (
                    <div
                      className="tableau-card-wrapper"
                      key={`pile-${pileIndex}-card-${cardIndex}`}
                    >
                      {renderCard(
                        card,
                        `pile-${pileIndex}-card-${cardIndex}-inner`
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;