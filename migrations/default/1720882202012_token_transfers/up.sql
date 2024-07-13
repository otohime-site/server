CREATE TABLE "public"."token_transfers"(
    "id" SERIAL,
    "token_id" uuid NOT NULL,
    "old_user_id" text NOT NULL,
    "new_user_id" text NOT NULL UNIQUE,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);