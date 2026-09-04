CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    username VARCHAR(30) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE player_stats (
    user_id BIGINT PRIMARY KEY,
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    pb_time DOUBLE PRECISION,
    pb_moves INTEGER,

    CONSTRAINT fk_player_stats_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id),

    CONSTRAINT chk_games_played_nonnegative
        CHECK (games_played >= 0),

    CONSTRAINT chk_wins_nonnegative
        CHECK (wins >= 0),

    CONSTRAINT chk_wins_not_greater_than_games
        CHECK (wins <= games_played),

    CONSTRAINT chk_pb_time_positive
        CHECK (pb_time IS NULL OR pb_time > 0),

    CONSTRAINT chk_pb_moves_positive
        CHECK (pb_moves IS NULL OR pb_moves > 0)
);