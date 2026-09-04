# SRW Database Schema Blueprint

### USER

| Attribute | PostgreSQL Type | Purpose |
|---|---|---|
| user_id | BIGSERIAL | Primary key. Unique internal ID for each user. |
| username | VARCHAR(30) | Unique username shown to other players. |
| password_hash | TEXT | Secure hashed version of the user's password. Never store plaintext passwords. |
| created_at | TIMESTAMPTZ | Date/time the account was created. |

### Defaults and NULL Rules

- `user_id` cannot be NULL.
- `username` cannot be NULL.
- `password_hash` cannot be NULL.
- `created_at` cannot be NULL and should default to the current timestamp.

## PLAYER_STATS

| Attribute | PostgreSQL Type | Purpose |
|---|---|---|
| user_id | BIGINT | Primary key and foreign key referencing USER.user_id. |
| games_played | INTEGER | Number of multiplayer games the player has started. |
| wins | INTEGER | Number of multiplayer games the player has won. |
| pb_time | DOUBLE PRECISION | Player's fastest completed-game time in seconds. |
| pb_moves | INTEGER | Player's lowest move count for a completed game. |

### Defaults and NULL Rules

- `user_id` cannot be NULL.
- `games_played` cannot be NULL and should default to `0`.
- `wins` cannot be NULL and should default to `0`.
- `pb_time` may be NULL because a new player may not have completed a game yet.
- `pb_moves` may be NULL because a new player may not have completed a game yet.

### Constraints

- `user_id` is the primary key.
- `user_id` is also a foreign key referencing `USER.user_id`.
- Each user can have only one PLAYER_STATS record.

### Constraints

- `games_played >= 0`
- `wins >= 0`
- `wins <= games_played`
- `pb_time > 0` when not NULL
- `pb_moves > 0` when not NULL

## Relationship

USER and PLAYER_STATS have a one-to-one relationship.

```text
USER
-------------------------
user_id          PK
username         UNIQUE
password_hash
created_at
        |
        | 1 : 1
        |
PLAYER_STATS
-------------------------
user_id          PK, FK
games_played
wins
pb_time
pb_moves