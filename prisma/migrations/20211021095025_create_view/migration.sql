CREATE VIEW ff_record_aggregates AS
    SELECT
        targets.ff_record_id, targets.user_id
    FROM (
        -- Aggregate targets of ff_record_id
        SELECT
            r.id AS ff_record_id
            , d.type AS type
            , d_r.user_id as user_id
            , ROW_NUMBER()
                OVER (
                    PARTITION BY
                        r.id, d.user_id
                    ORDER BY
                        d_r.created_at
                        DESC
                )
            AS rank
        FROM
            ff_records AS r
            CROSS JOIN ff_record_diffs AS d
            LEFT JOIN ff_records AS d_r ON d_r.id = d.ff_record_id
        WHERE
            d_r.type = r.type
            AND d_r.user_id = r.user_id
            AND d_r.created_at <= r.created_at
    ) as targets
        WHERE
            targets.rank = 1
            AND targets.type = 'ADDITION';

CREATE VIEW users AS
    SELECT
        *
    FROM
        user_records AS u
    WHERE
        NOT EXISTS
        (
            SELECT
                *
            FROM
                user_records AS u2
            WHERE
                u2.id = u.id
                AND u2.created_at > u.created_at
        );
