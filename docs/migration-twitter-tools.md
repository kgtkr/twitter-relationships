# Migration twitter-tools

[twitter-tools](https://github.com/kgtkr/twitter-tools)


```sh
$ docker-compose exec psql sh
$ psql -U postgres
```

```sql
CREATE SCHEMA public_old;
ALTER TABLE ffs SET SCHEMA public_old;
ALTER TABLE followers SET SCHEMA public_old;
ALTER TABLE friends SET SCHEMA public_old;
ALTER TABLE raws SET SCHEMA public_old;

CREATE TEMPORARY TABLE ff_ids (
    id UUID NOT NULL,
    friend_id UUID NOT NULL,
    follower_id UUID NOT NULL,
    prev UUID,
    next UUID,

    CONSTRAINT pk_ff_ids PRIMARY KEY (id)
);

INSERT INTO ff_ids (id, friend_id, follower_id, prev, next)
    SELECT 
    id
    , gen_random_uuid()
    , gen_random_uuid()
    , LAG(id) OVER (PARTITION BY user_id ORDER BY created_at)
    , LEAD(id) OVER (PARTITION BY user_id ORDER BY created_at)
    FROM public_old.ffs;

CREATE INDEX idx_ff_ids_1 ON ff_ids (id);
CREATE INDEX idx_ff_ids_2 ON ff_ids (friend_id);
CREATE INDEX idx_ff_ids_3 ON ff_ids (follower_id);
CREATE INDEX idx_ff_ids_4 ON ff_ids (prev);
CREATE INDEX idx_ff_ids_5 ON ff_ids (next);
```

```sh
$ npm run migrate;
```

```sql
INSERT
    INTO
        ff_records (id, user_id, created_at, type)
    SELECT
        ff_ids.follower_id, ffs.user_id, ffs.created_at, 'FOLLOWER'
    FROM
        public_old.ffs AS ffs
    LEFT JOIN
        ff_ids AS ff_ids ON ffs.id = ff_ids.id;

INSERT
    INTO
        ff_records (id, user_id, created_at, type)
    SELECT
        ff_ids.friend_id, ffs.user_id, ffs.created_at, 'FRIEND'
    FROM
        public_old.ffs AS ffs
    LEFT JOIN
        ff_ids AS ff_ids ON ffs.id = ff_ids.id;

INSERT
    INTO
        user_records (id, created_at, json)
    SELECT
        id, created_at, raw
    FROM
        public_old.raws;

INSERT
    INTO
        ff_record_diffs (ff_record_id, user_id, type)
    SELECT
        ff_ids.follower_id as ff_record_id
        , followers.user_id as user_id
        , 'ADDITION'
    FROM
        public_old.followers AS followers
        LEFT JOIN public_old.ffs AS ffs ON ffs.id = followers.ff_id
        LEFT JOIN ff_ids AS ff_ids ON ff_ids.id = ffs.id
    WHERE
        NOT EXISTS (
            SELECT *
            FROM public_old.followers AS followers2
            WHERE followers2.user_id = followers.user_id
                AND followers2.ff_id = ff_ids.prev
        );

INSERT
    INTO
        ff_record_diffs (ff_record_id, user_id, type)
    SELECT
        ff_ids2.follower_id as ff_record_id
        , followers.user_id as user_id
        , 'DELETION'
    FROM
        public_old.followers AS followers
        LEFT JOIN public_old.ffs AS ffs ON ffs.id = followers.ff_id
        LEFT JOIN ff_ids AS ff_ids ON ff_ids.id = ffs.id
        LEFT JOIN ff_ids AS ff_ids2 ON ff_ids2.id = ff_ids.next
    WHERE
        NOT EXISTS (
            SELECT *
            FROM public_old.followers AS followers2
            WHERE followers2.user_id = followers.user_id
                AND followers2.ff_id = ff_ids.next
        )
        AND ff_ids.next IS NOT NULL;

INSERT
    INTO
        ff_record_diffs (ff_record_id, user_id, type)
    SELECT
        ff_ids.friend_id as ff_record_id
        , friends.user_id as user_id
        , 'ADDITION'
    FROM
        public_old.friends AS friends
        LEFT JOIN public_old.ffs AS ffs ON ffs.id = friends.ff_id
        LEFT JOIN ff_ids AS ff_ids ON ff_ids.id = ffs.id
    WHERE
        NOT EXISTS (
            SELECT *
            FROM public_old.friends AS friends2
            WHERE friends2.user_id = friends.user_id
                AND friends2.ff_id = ff_ids.prev
        );

INSERT
    INTO
        ff_record_diffs (ff_record_id, user_id, type)
    SELECT
        ff_ids2.friend_id as ff_record_id
        , friends.user_id as user_id
        , 'DELETION'
    FROM
        public_old.friends AS friends
        LEFT JOIN public_old.ffs AS ffs ON ffs.id = friends.ff_id
        LEFT JOIN ff_ids AS ff_ids ON ff_ids.id = ffs.id
        LEFT JOIN ff_ids AS ff_ids2 ON ff_ids2.id = ff_ids.next
    WHERE
        NOT EXISTS (
            SELECT *
            FROM public_old.friends AS friends2
            WHERE friends2.user_id = friends.user_id
                AND friends2.ff_id = ff_ids.next
        )
        AND ff_ids.next IS NOT NULL;

DROP SCHEMA public_old CASCADE;
```
