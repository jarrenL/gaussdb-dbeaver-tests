-- Isolated session: no persistent objects. Result sequence must be 1,1,1,1,2,3,1.
BEGIN;
CREATE TEMP TABLE q(id integer);
CREATE TEMP TABLE "Q"(id integer);
INSERT INTO q VALUES(2);
INSERT INTO "Q" VALUES(3);
WITH Q AS (SELECT 1 AS id) SELECT id AS case1 FROM q;
WITH q AS (SELECT 1 AS id) SELECT id AS case2 FROM Q;
WITH "q" AS (SELECT 1 AS id) SELECT id AS case3 FROM q;
WITH q AS (SELECT 1 AS id) SELECT id AS case4 FROM "q";
WITH "Q" AS (SELECT 1 AS id) SELECT id AS case5 FROM q;
WITH q AS (SELECT 1 AS id) SELECT id AS case6 FROM "Q";
WITH "Q" AS (SELECT 1 AS id) SELECT id AS case7 FROM "Q";
ROLLBACK;
