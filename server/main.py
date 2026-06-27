import random
from dataclasses import dataclass, field
import time

from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
SUITS = ["H", "D", "C", "S"]

BASE_RESET_PENALTY = 30.0
MIN_RESET_PENALTY = 5.0

FOUNDATION_SCORE_PER_CARD = 10
REVEAL_SCORE_PER_CARD = 6
FOUNDATION_TO_TABLEAU_PENALTY = 8
WRONG_MOVE_PENALTY = 1
INITIAL_TABLEAU_FACE_DOWN_CARDS = 21

CURRENT_MATCH_ID = "local-match"
CURRENT_PLAYER_ID = "local-player"


@dataclass
class PlayerState:
    player_id: str
    deal_index: int
    game_state: dict
    wrong_move_count: int = 0
    foundation_to_tableau_count: int = 0
    penalty_total: float = 0.0
    reset_count: int = 0
    move_count: int = 0
    finished: bool = False
    eliminated: bool = False
    final_time: float | None = None
    quit: bool = False


@dataclass
class MatchState:
    match_id: str
    match_seed: int
    players: dict[str, PlayerState]
    status: str = "lobby"
    target_time: float | None = None
    leading_player_id: str | None = None
    ready_player_ids: set[str] = field(default_factory=set)
    countdown_start_time: float | None = None
    scheduled_start_time: float | None = None


class WasteToTableauMove(BaseModel):
    tableauIndex: int


class WasteToFoundationMove(BaseModel):
    foundation: str


class TableauToFoundationMove(BaseModel):
    tableauIndex: int


class TableauToTableauMove(BaseModel):
    fromTableauIndex: int
    fromCardIndex: int
    toTableauIndex: int


class FoundationToTableauMove(BaseModel):
    foundationKey: str
    tableauIndex: int


class CreateMatchRequest(BaseModel):
    playerId: str = "player-1"

class FinishPlayerRequest(BaseModel):
    elapsedTime: float


class CheckEliminationRequest(BaseModel):
    elapsedTime: float

def get_deal_seed(match_seed: int, deal_index: int) -> int:
    return match_seed + deal_index


def make_card(rank: str, suit: str, face_up: bool) -> dict:
    return {
        "rank": rank,
        "suit": suit,
        "code": f"{rank}{suit}",
        "faceUp": face_up,
    }


def build_deck() -> list[dict]:
    deck = []
    for suit in SUITS:
        for rank in RANKS:
            deck.append(make_card(rank, suit, False))
    return deck


def build_new_game_state(seed: int) -> dict:
    deck = build_deck()

    rng = random.Random(seed)
    rng.shuffle(deck)

    tableau = []
    for pile_size in range(1, 8):
        pile = []
        for card_index in range(pile_size):
            card = deck.pop(0)
            card["faceUp"] = (card_index == pile_size - 1)
            pile.append(card)
        tableau.append(pile)

    stock = deck

    return {
        "stock": stock,
        "waste": [],
        "foundations": {
            "hearts": [],
            "diamonds": [],
            "clubs": [],
            "spades": [],
        },
        "tableau": tableau,
    }


def copy_card(card: dict) -> dict:
    return {
        "rank": card["rank"],
        "suit": card["suit"],
        "code": card["code"],
        "faceUp": card["faceUp"],
    }


def copy_game_state(state: dict) -> dict:
    return {
        "stock": [copy_card(card) for card in state["stock"]],
        "waste": [copy_card(card) for card in state["waste"]],
        "foundations": {
            "hearts": [copy_card(card) for card in state["foundations"]["hearts"]],
            "diamonds": [copy_card(card) for card in state["foundations"]["diamonds"]],
            "clubs": [copy_card(card) for card in state["foundations"]["clubs"]],
            "spades": [copy_card(card) for card in state["foundations"]["spades"]],
        },
        "tableau": [
            [copy_card(card) for card in pile]
            for pile in state["tableau"]
        ],
    }


def get_card_color(card: dict) -> str:
    if card["suit"] in ["H", "D"]:
        return "red"
    return "black"


def get_rank_value(rank: str) -> int:
    rank_values = {
        "A": 1,
        "2": 2,
        "3": 3,
        "4": 4,
        "5": 5,
        "6": 6,
        "7": 7,
        "8": 8,
        "9": 9,
        "10": 10,
        "J": 11,
        "Q": 12,
        "K": 13,
    }
    return rank_values[rank]


def count_foundation_cards(state: dict) -> int:
    return sum(len(pile) for pile in state["foundations"].values())


def count_face_down_tableau_cards(state: dict) -> int:
    count = 0
    for pile in state["tableau"]:
        for card in pile:
            if not card["faceUp"]:
                count += 1
    return count


def count_revealed_hidden_cards(state: dict) -> int:
    return INITIAL_TABLEAU_FACE_DOWN_CARDS - count_face_down_tableau_cards(state)


def calculate_deal_progress_score(player: PlayerState) -> int:
    state = player.game_state

    foundation_cards = count_foundation_cards(state)
    revealed_hidden_cards = count_revealed_hidden_cards(state)

    foundation_points = foundation_cards * FOUNDATION_SCORE_PER_CARD
    reveal_points = revealed_hidden_cards * REVEAL_SCORE_PER_CARD
    backtrack_penalty = player.foundation_to_tableau_count * FOUNDATION_TO_TABLEAU_PENALTY
    wrong_move_penalty = player.wrong_move_count * WRONG_MOVE_PENALTY

    return foundation_points + reveal_points - backtrack_penalty - wrong_move_penalty


def calculate_reset_penalty(
    state: dict,
    base_penalty: float = BASE_RESET_PENALTY,
    min_penalty: float = MIN_RESET_PENALTY,
) -> float:
    foundation_cards = count_foundation_cards(state)
    penalty = base_penalty * (1 - foundation_cards / 52)
    return max(min_penalty, penalty)


def success_response(player: PlayerState) -> dict:
    return {
        "gameState": copy_game_state(player.game_state),
        "dealProgressScore": calculate_deal_progress_score(player),
        "matchId": CURRENT_MATCH_ID,
        "playerId": player.player_id,
        "dealIndex": player.deal_index,
        "resetCount": player.reset_count,
        "moveCount": player.move_count,
        "penaltyTotal": player.penalty_total,
    }


def error_response(player: PlayerState, message: str) -> dict:
    return {
        "error": message,
        "gameState": copy_game_state(player.game_state),
        "dealProgressScore": calculate_deal_progress_score(player),
        "matchId": CURRENT_MATCH_ID,
        "playerId": player.player_id,
        "dealIndex": player.deal_index,
        "resetCount": player.reset_count,
        "moveCount": player.move_count,
        "penaltyTotal": player.penalty_total,
    }


def can_place_on_tableau(moving_card: dict, target_pile: list[dict]) -> bool:
    if len(target_pile) == 0:
        return moving_card["rank"] == "K"

    target_card = target_pile[-1]
    if not target_card["faceUp"]:
        return False

    different_color = get_card_color(moving_card) != get_card_color(target_card)
    one_rank_lower = get_rank_value(moving_card["rank"]) == get_rank_value(target_card["rank"]) - 1

    return different_color and one_rank_lower


def can_place_on_foundation(
    moving_card: dict,
    foundation_pile: list[dict],
    foundation_key: str,
) -> bool:
    foundation_suit_map = {
        "hearts": "H",
        "diamonds": "D",
        "clubs": "C",
        "spades": "S",
    }

    expected_suit = foundation_suit_map[foundation_key]
    if moving_card["suit"] != expected_suit:
        return False

    if len(foundation_pile) == 0:
        return moving_card["rank"] == "A"

    top_card = foundation_pile[-1]
    return get_rank_value(moving_card["rank"]) == get_rank_value(top_card["rank"]) + 1


def move_waste_to_tableau(state: dict, tableau_index: int) -> dict:
    if tableau_index < 0 or tableau_index >= len(state["tableau"]):
        raise ValueError("Invalid tableau index")

    if len(state["waste"]) == 0:
        raise ValueError("Waste is empty")

    moving_card = state["waste"][-1]
    target_pile = state["tableau"][tableau_index]

    if not can_place_on_tableau(moving_card, target_pile):
        raise ValueError("Illegal waste to tableau move")

    moved_card = state["waste"].pop()
    state["tableau"][tableau_index].append(moved_card)
    return state


def move_waste_to_foundation(state: dict, foundation_key: str) -> dict:
    if foundation_key not in state["foundations"]:
        raise ValueError("Invalid foundation")

    if len(state["waste"]) == 0:
        raise ValueError("Waste is empty")

    moving_card = state["waste"][-1]
    foundation_pile = state["foundations"][foundation_key]

    if not can_place_on_foundation(moving_card, foundation_pile, foundation_key):
        raise ValueError("Illegal waste to foundation move")

    moved_card = state["waste"].pop()
    foundation_pile.append(moved_card)
    return state


def move_tableau_to_foundation(state: dict, tableau_index: int) -> dict:
    if tableau_index < 0 or tableau_index >= len(state["tableau"]):
        raise ValueError("Invalid tableau index")

    tableau_pile = state["tableau"][tableau_index]
    if len(tableau_pile) == 0:
        raise ValueError("Tableau pile is empty")

    moving_card = tableau_pile[-1]
    if not moving_card["faceUp"]:
        raise ValueError("Top tableau card is face down")

    foundation_map = {
        "H": "hearts",
        "D": "diamonds",
        "C": "clubs",
        "S": "spades",
    }

    foundation_key = foundation_map[moving_card["suit"]]
    foundation_pile = state["foundations"][foundation_key]

    if not can_place_on_foundation(moving_card, foundation_pile, foundation_key):
        raise ValueError("Illegal waste to foundation move")

    moved_card = tableau_pile.pop()
    foundation_pile.append(moved_card)

    if len(tableau_pile) > 0 and not tableau_pile[-1]["faceUp"]:
        tableau_pile[-1]["faceUp"] = True

    return state


def is_valid_tableau_tail(cards: list[dict]) -> bool:
    if len(cards) == 0:
        return False

    for card in cards:
        if not card["faceUp"]:
            return False

    for i in range(len(cards) - 1):
        upper = cards[i]
        lower = cards[i + 1]

        different_color = get_card_color(upper) != get_card_color(lower)
        one_rank_down = get_rank_value(lower["rank"]) == get_rank_value(upper["rank"]) - 1

        if not (different_color and one_rank_down):
            return False

    return True


def move_tableau_to_tableau(
    state: dict,
    from_tableau_index: int,
    from_card_index: int,
    to_tableau_index: int,
) -> dict:
    tableau = state["tableau"]

    if from_tableau_index < 0 or from_tableau_index >= len(tableau):
        raise ValueError("Invalid source tableau index")

    if to_tableau_index < 0 or to_tableau_index >= len(tableau):
        raise ValueError("Invalid destination tableau index")

    if from_tableau_index == to_tableau_index:
        raise ValueError("Source and destination tableau are the same")

    source_pile = tableau[from_tableau_index]
    target_pile = tableau[to_tableau_index]

    if from_card_index < 0 or from_card_index >= len(source_pile):
        raise ValueError("Invalid source card index")

    moving_cards = source_pile[from_card_index:]
    if not is_valid_tableau_tail(moving_cards):
        raise ValueError("Selected tableau run is not movable")

    first_moving_card = moving_cards[0]
    if not can_place_on_tableau(first_moving_card, target_pile):
        raise ValueError("Illegal tableau to tableau move")

    tableau[from_tableau_index] = source_pile[:from_card_index]
    tableau[to_tableau_index].extend(moving_cards)

    if len(tableau[from_tableau_index]) > 0:
        new_top = tableau[from_tableau_index][-1]
        if not new_top["faceUp"]:
            new_top["faceUp"] = True

    return state


def move_foundation_to_tableau(
    state: dict,
    foundation_key: str,
    tableau_index: int,
) -> dict:
    if foundation_key not in state["foundations"]:
        raise ValueError("Invalid foundation")

    if tableau_index < 0 or tableau_index >= len(state["tableau"]):
        raise ValueError("Invalid tableau index")

    foundation_pile = state["foundations"][foundation_key]
    target_pile = state["tableau"][tableau_index]

    if len(foundation_pile) == 0:
        raise ValueError("Foundation is empty")

    moving_card = foundation_pile[-1]
    if not can_place_on_tableau(moving_card, target_pile):
        raise ValueError("Illegal foundation to tableau move")

    moved_card = foundation_pile.pop()
    target_pile.append(moved_card)
    return state


def draw_from_stock(state: dict) -> dict:
    stock = state["stock"]
    waste = state["waste"]

    if len(stock) == 0:
        state["stock"] = [{**card, "faceUp": False} for card in waste]
        state["waste"] = []
        return state

    draw_count = min(3, len(stock))
    drawn_cards = []
    for _ in range(draw_count):
        card = stock.pop(0)
        card["faceUp"] = True
        drawn_cards.append(card)

    waste.extend(drawn_cards)
    return state


def reset_player_deal_tracking(player: PlayerState) -> None:
    player.wrong_move_count = 0
    player.foundation_to_tableau_count = 0


def build_player_state(player_id: str, match_seed: int, deal_index: int = 0) -> PlayerState:
    return PlayerState(
        player_id=player_id,
        deal_index=deal_index,
        game_state=build_new_game_state(get_deal_seed(match_seed, deal_index)),
    )


def build_match_state(match_id: str, player_id: str) -> MatchState:
    match_seed = random.randrange(1_000_000_000)
    player = build_player_state(player_id, match_seed)

    return MatchState(
        match_id=match_id,
        match_seed=match_seed,
        players={player_id: player},
    )


matches: dict[str, MatchState] = {
    CURRENT_MATCH_ID: build_match_state(CURRENT_MATCH_ID, CURRENT_PLAYER_ID)
}


def get_current_match() -> MatchState:
    return matches[CURRENT_MATCH_ID]

def get_current_player() -> PlayerState:
    return get_current_match().players[CURRENT_PLAYER_ID]

def get_player(match_id: str, player_id: str) -> PlayerState:
    if match_id not in matches:
        raise ValueError("Match not found")

    match = matches[match_id]

    if player_id not in match.players:
        raise ValueError("Player not found")

    return match.players[player_id]

def get_active_player(match_id: str, player_id: str) -> PlayerState:
    if match_id not in matches:
        raise ValueError("Match not found")

    match = matches[match_id]

    if match.status == "lobby":
        raise ValueError("Match has not started")

    if match.status == "finished":
        raise ValueError("Match is already finished")

    if player_id not in match.players:
        raise ValueError("Player not found")

    player = match.players[player_id]

    if player.finished:
        raise ValueError("Player already finished")

    # if player.eliminated:
    #     raise ValueError("Player is eliminated")
    
    if player.quit:
        raise ValueError("Player has quit")

    return player


@app.get("/ping")
def ping():
    return {"message": "pong"}

@app.get("/matches/{match_id}")
def get_match_status(match_id: str):
    if match_id not in matches:
        return {"error": "Match not found"}

    match = matches[match_id]

    if (
        match.status == "countdown"
        and match.scheduled_start_time is not None
        and time.time() >= match.scheduled_start_time
    ):
        match.status = "playing"

    return {
        "matchId": match.match_id,
        "status": match.status,
        "playerCount": len(match.players),
        "readyPlayerCount": len(match.ready_player_ids),
        "readyPlayerIds": list(match.ready_player_ids),
        "countdownStartTime": match.countdown_start_time,
        "scheduledStartTime": match.scheduled_start_time,
        "targetTime": match.target_time,
        "leadingPlayerId": match.leading_player_id,
        "winnerPlayerId": match.leading_player_id if match.status == "finished" else None,
        "players": [
            {
                "playerId": player.player_id,
                "dealIndex": player.deal_index,
                "resetCount": player.reset_count,
                "moveCount": player.move_count,
                "penaltyTotal": player.penalty_total,
                "dealProgressScore": calculate_deal_progress_score(player),
                "finished": player.finished,
                "eliminated": player.eliminated,
                "quit": player.quit,
                "finalTime": player.final_time,
                "currentTotalTime": None,
            }
            for player in match.players.values()
        ],
    }

@app.post("/matches/{match_id}/players/{player_id}/quit")
def quit_player(match_id: str, player_id: str):
    try:
        player = get_player(match_id, player_id)
        match = matches[match_id]

        player.quit = True

        all_done = all(
            p.finished or p.quit
            for p in match.players.values()
        )

        if all_done:
            match.status = "finished"

        return {
            "matchId": match.match_id,
            "status": match.status,
            "playerId": player.player_id,
            "quit": player.quit,
        }

    except ValueError as e:
        return {"error": str(e)}

@app.get("/matches/{match_id}/summary")
def get_match_summary(match_id: str):
    if match_id not in matches:
        return {"error": "Match not found"}

    match = matches[match_id]

    # if match.status != "finished":
    #     return {"error": "Match is not finished yet"}

    return {
        "matchId": match.match_id,
        "status": match.status,
        "winnerPlayerId": match.leading_player_id,
        "winningTime": match.target_time,
        "players": [
            {
                "rank": index + 1,
                "playerId": player.player_id,
                "outcome": (
                    "winner"
                    if player.player_id == match.leading_player_id
                    else "finished"
                    if player.finished
                    else "quit"
                    if player.quit
                    else "playing"
                ),
                "outOfContention": player.eliminated,
                "finished": player.finished,
                "eliminated": player.eliminated,
                "quit": player.quit,
                "finalTime": player.final_time,
                "penaltyTotal": player.penalty_total,
                "resetCount": player.reset_count,
                "moveCount": player.move_count,
                "dealIndex": player.deal_index,
            }
            for index, player in enumerate(
                sorted(
                    match.players.values(),
                    key=lambda p: (
                        0 if p.finished else 1 if not p.quit else 2,
                        p.final_time if p.final_time is not None else float("inf"),
                    ),
                )
            )
        ],
    }

@app.post("/matches/{match_id}/players/{player_id}/ready")
def ready_player(match_id: str, player_id: str):
    if match_id not in matches:
        return {"error": "Match not found"}

    match = matches[match_id]

    if match.status != "lobby":
        return {"error": "Match is not in lobby"}

    if player_id not in match.players:
        return {"error": "Player not found"}

    match.ready_player_ids.add(player_id)

    if len(match.players) >= 2 and len(match.ready_player_ids) == len(match.players):
        match.status = "countdown"
        match.countdown_start_time = time.time()
        match.scheduled_start_time = match.countdown_start_time + 3

    return {
        "matchId": match.match_id,
        "status": match.status,
        "playerCount": len(match.players),
        "readyPlayerCount": len(match.ready_player_ids),
        "readyPlayerIds": list(match.ready_player_ids),
        "countdownStartTime": match.countdown_start_time,
        "scheduledStartTime": match.scheduled_start_time,
    }


@app.post("/matches/{match_id}/start")
def start_match(match_id: str):
    if match_id not in matches:
        return {"error": "Match not found"}

    match = matches[match_id]

    if match.status != "lobby":
        return {"error": "Match already started"}

    if len(match.players) < 2:
        return {"error": "Need at least 2 players to start"}

    match.status = "playing"

    return {
        "matchId": match.match_id,
        "status": match.status,
        "playerCount": len(match.players),
        "players": list(match.players.keys()),
    }

@app.post("/matches/{match_id}/players/{player_id}/finish")
def finish_player(match_id: str, player_id: str, request: FinishPlayerRequest):
    try:
        player = get_active_player(match_id, player_id)
        match = matches[match_id]

        

        if player.finished:
            return {"error": "Player already finished"}

        final_time = request.elapsedTime + player.penalty_total

        player.finished = True
        player.final_time = final_time

        if match.target_time is None or final_time < match.target_time:
            match.target_time = final_time
            match.leading_player_id = player.player_id
        all_done = all(
            p.finished or p.quit
            for p in match.players.values()
        )

        if all_done:
            match.status = "finished"

        return {
            "matchId": match.match_id,
            "status": match.status,
            "playerId": player.player_id,
            "finished": player.finished,
            "elapsedTime": request.elapsedTime,
            "penaltyTotal": player.penalty_total,
            "finalTime": player.final_time,
            "targetTime": match.target_time,
            "leadingPlayerId": match.leading_player_id,
        }

    except ValueError as e:
        return {"error": str(e)}
    
@app.post("/matches/{match_id}/players/{player_id}/check-elimination")
def check_player_elimination(
    match_id: str,
    player_id: str,
    request: CheckEliminationRequest,
):
    try:
        player = get_active_player(match_id, player_id)
        match = matches[match_id]

        if match.target_time is None:
            return {
                "matchId": match.match_id,
                "playerId": player.player_id,
                "eliminated": False,
                "reason": "No target time yet",
            }

        if player.finished:
            return {
                "matchId": match.match_id,
                "playerId": player.player_id,
                "eliminated": False,
                "reason": "Player already finished",
            }

        current_total_time = request.elapsedTime + player.penalty_total

        if current_total_time >= match.target_time:
            player.eliminated = True

       

        return {
            "matchId": match.match_id,
            "status": match.status,
            "playerId": player.player_id,
            "elapsedTime": request.elapsedTime,
            "penaltyTotal": player.penalty_total,
            "currentTotalTime": current_total_time,
            "targetTime": match.target_time,
            "leadingPlayerId": match.leading_player_id,
            "eliminated": player.eliminated,
        }

    except ValueError as e:
        return {"error": str(e)}

@app.post("/matches")
def create_match(request: CreateMatchRequest):
    match_id = str(random.randrange(100000, 1000000))
    matches[match_id] = build_match_state(match_id, request.playerId)

    player = matches[match_id].players[request.playerId]

    return {
        "matchId": match_id,
        "playerId": player.player_id,
        "gameState": copy_game_state(player.game_state),
        "dealProgressScore": calculate_deal_progress_score(player),
    }




@app.post("/matches/{match_id}/players/{player_id}")
def add_player_to_match(match_id: str, player_id: str):
    if match_id not in matches:
        return {"error": "Match not found"}

    match = matches[match_id]
    if match.status != "lobby":
        return {"error": "Cannot join match after it has started"}

    if player_id in match.players:
        return {"error": "Player already exists"}

    player = build_player_state(
        player_id=player_id,
        match_seed=match.match_seed,
        deal_index=0,
    )

    match.players[player_id] = player

    return {
        "matchId": match_id,
        "playerId": player.player_id,
        "gameState": copy_game_state(player.game_state),
        "dealProgressScore": calculate_deal_progress_score(player),
    }


@app.get("/matches/{match_id}/players/{player_id}/game-state")
def get_player_game_state(match_id: str, player_id: str):
    try:
        player = get_player(match_id, player_id)

        return {
            "matchId": match_id,
            "playerId": player.player_id,
            "dealIndex": player.deal_index,
            "resetCount": player.reset_count,
            "moveCount": player.move_count,
            "penaltyTotal": player.penalty_total,
            "gameState": copy_game_state(player.game_state),
            "dealProgressScore": calculate_deal_progress_score(player),
        }

    except ValueError as e:
        return {"error": str(e)}


@app.get("/game-state")
def get_game_state():
    player = get_current_player()
    return success_response(player)


@app.post("/new-game")
def new_game():
    matches[CURRENT_MATCH_ID] = build_match_state(CURRENT_MATCH_ID, CURRENT_PLAYER_ID)
    player = get_current_player()
    return success_response(player)


@app.post("/reset")
def reset_game():
    player = get_current_player()
    match = get_current_match()

    penalty_applied = calculate_reset_penalty(player.game_state)
    player.penalty_total += penalty_applied
    player.reset_count += 1
    player.deal_index += 1

    reset_player_deal_tracking(player)
    player.game_state = build_new_game_state(
        get_deal_seed(match.match_seed, player.deal_index)
    )

    return {
        "gameState": copy_game_state(player.game_state),
        "penaltyApplied": penalty_applied,
        "dealProgressScore": calculate_deal_progress_score(player),
    }


@app.post("/move/waste-to-tableau")
def move_waste_card(move: WasteToTableauMove):
    player = get_current_player()

    try:
        player.game_state = move_waste_to_tableau(player.game_state, move.tableauIndex)
        player.move_count += 1
        return success_response(player)
    except ValueError as e:
        player.wrong_move_count += 1
        return error_response(player, str(e))

@app.post("/matches/{match_id}/players/{player_id}/move/waste-to-tableau")
def move_waste_card_for_player(
    match_id: str,
    player_id: str,
    move: WasteToTableauMove,
):
    try:
        player = get_active_player(match_id, player_id)

        player.game_state = move_waste_to_tableau(
            player.game_state,
            move.tableauIndex,
        )

        player.move_count += 1

        return {
            "matchId": match_id,
            "playerId": player.player_id,
            "dealIndex": player.deal_index,
            "resetCount": player.reset_count,
            "moveCount": player.move_count,
            "penaltyTotal": player.penalty_total,
            "gameState": copy_game_state(
                player.game_state
            ),
            "dealProgressScore": calculate_deal_progress_score(
                player
            ),
        }

    except ValueError as e:
        player = get_player(
            match_id,
            player_id,
        )

        player.wrong_move_count += 1

        return {
            "error": str(e),
            "matchId": match_id,
            "playerId": player.player_id,
            "dealProgressScore": calculate_deal_progress_score(
                player
            ),
            "gameState": copy_game_state(
                player.game_state
            ),
        }

@app.post("/move/waste-to-foundation")
def move_waste_to_foundation_route(move: WasteToFoundationMove):
    player = get_current_player()

    try:
        player.game_state = move_waste_to_foundation(player.game_state, move.foundation)
        player.move_count += 1
        return success_response(player)
    except ValueError as e:
        player.wrong_move_count += 1
        return error_response(player, str(e))
    
@app.post(
    "/matches/{match_id}/players/{player_id}/move/waste-to-foundation"
)
def move_waste_to_foundation_for_player(
    match_id: str,
    player_id: str,
    move: WasteToFoundationMove,
):
    try:
        player = get_active_player(match_id, player_id)

        player.game_state = move_waste_to_foundation(
            player.game_state,
            move.foundation,
        )

        player.move_count += 1

        return success_response(player)

    except ValueError as e:
        player = get_player(match_id, player_id)
        player.wrong_move_count += 1

        return error_response(player, str(e))


@app.post("/move/tableau-to-foundation")
def move_tableau_to_foundation_route(move: TableauToFoundationMove):
    player = get_current_player()

    try:
        player.game_state = move_tableau_to_foundation(player.game_state, move.tableauIndex)
        player.move_count += 1
        return success_response(player)
    except ValueError as e:
        player.wrong_move_count += 1
        return error_response(player, str(e))
    
@app.post(
    "/matches/{match_id}/players/{player_id}/move/tableau-to-foundation"
)
def move_tableau_to_foundation_for_player(
    match_id: str,
    player_id: str,
    move: TableauToFoundationMove,
):
    try:
        player = get_active_player(match_id, player_id)

        player.game_state = move_tableau_to_foundation(
            player.game_state,
            move.tableauIndex,
        )

        player.move_count += 1

        return success_response(player)

    except ValueError as e:
        player = get_player(match_id, player_id)
        player.wrong_move_count += 1

        return error_response(player, str(e))


@app.post("/move/tableau-to-tableau")
def move_tableau_to_tableau_route(move: TableauToTableauMove):
    player = get_current_player()

    try:
        player.game_state = move_tableau_to_tableau(
            player.game_state,
            move.fromTableauIndex,
            move.fromCardIndex,
            move.toTableauIndex,
        )
        player.move_count += 1
        return success_response(player)
    except ValueError as e:
        player.wrong_move_count += 1
        return error_response(player, str(e))
    
@app.post(
    "/matches/{match_id}/players/{player_id}/move/tableau-to-tableau"
)
def move_tableau_to_tableau_for_player(
    match_id: str,
    player_id: str,
    move: TableauToTableauMove,
):
    try:
        player = get_active_player(match_id, player_id)

        player.game_state = move_tableau_to_tableau(
            player.game_state,
            move.fromTableauIndex,
            move.fromCardIndex,
            move.toTableauIndex,
        )

        player.move_count += 1

        return success_response(player)

    except ValueError as e:
        player = get_player(match_id, player_id)
        player.wrong_move_count += 1

        return error_response(player, str(e))


@app.post("/move/foundation-to-tableau")
def move_foundation_to_tableau_route(move: FoundationToTableauMove):
    player = get_current_player()

    try:
        player.game_state = move_foundation_to_tableau(
            player.game_state,
            move.foundationKey,
            move.tableauIndex,
        )
        player.foundation_to_tableau_count += 1
        player.move_count += 1
        return success_response(player)
    except ValueError as e:
        player.wrong_move_count += 1
        return error_response(player, str(e))
    
@app.post(
    "/matches/{match_id}/players/{player_id}/move/foundation-to-tableau"
)
def move_foundation_to_tableau_for_player(
    match_id: str,
    player_id: str,
    move: FoundationToTableauMove,
):
    try:
        player = get_active_player(match_id, player_id)

        player.game_state = move_foundation_to_tableau(
            player.game_state,
            move.foundationKey,
            move.tableauIndex,
        )

        player.foundation_to_tableau_count += 1
        player.move_count += 1

        return success_response(player)

    except ValueError as e:
        player = get_player(match_id, player_id)
        player.wrong_move_count += 1

        return error_response(player, str(e))


@app.post("/draw")
def draw_cards():
    player = get_current_player()

    player.game_state = draw_from_stock(player.game_state)
    player.move_count += 1
    return success_response(player)

@app.post("/matches/{match_id}/players/{player_id}/draw")
def draw_cards_for_player(match_id: str, player_id: str):
    try:
        player = get_active_player(match_id, player_id)

        player.game_state = draw_from_stock(player.game_state)
        player.move_count += 1

        return {
            "matchId": match_id,
            "playerId": player.player_id,
            "dealIndex": player.deal_index,
            "resetCount": player.reset_count,
            "moveCount": player.move_count,
            "penaltyTotal": player.penalty_total,
            "gameState": copy_game_state(player.game_state),
            "dealProgressScore": calculate_deal_progress_score(player),
        }

    except ValueError as e:
        return {"error": str(e)}


@app.post("/matches/{match_id}/players/{player_id}/reset")
def reset_player_deal(match_id: str, player_id: str):
    try:
        player = get_active_player(match_id, player_id)

        match = matches[match_id]

        penalty_applied = calculate_reset_penalty(
            player.game_state
        )

        player.penalty_total += penalty_applied
        player.reset_count += 1
        player.deal_index += 1

        reset_player_deal_tracking(player)

        player.game_state = build_new_game_state(
            get_deal_seed(
                match.match_seed,
                player.deal_index,
            )
        )

        return {
            "matchId": match_id,
            "playerId": player.player_id,
            "penaltyApplied": penalty_applied,
            "dealIndex": player.deal_index,
            "resetCount": player.reset_count,
            "penaltyTotal": player.penalty_total,
            "gameState": copy_game_state(
                player.game_state
            ),
            "dealProgressScore": calculate_deal_progress_score(
                player
            ),
        }

    except ValueError as e:
        if str(e) == "Match has not started":
            return {"error": str(e)}