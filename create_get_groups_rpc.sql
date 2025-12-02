CREATE OR REPLACE FUNCTION get_groups_with_unread_count(current_user_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    whatsapp_group_id TEXT,
    avatar_url TEXT,
    members JSONB,
    unread_count BIGINT,
    last_message_time TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.name,
        g.whatsapp_group_id,
        g.avatar_url,
        COALESCE(
            (
                SELECT jsonb_agg(jsonb_build_object('phone', m.phone))
                FROM whatsapp_group_members m
                WHERE m.group_id = g.id
            ),
            '[]'::jsonb
        ) AS members,
        (
            SELECT COUNT(*)
            FROM whatsapp_group_messages msg
            LEFT JOIN whatsapp_group_reads r ON r.group_id = g.id AND r.user_id = current_user_id
            WHERE msg.group_id = g.id
            AND (r.last_read_at IS NULL OR msg.created_at > r.last_read_at)
        ) AS unread_count,
        (
            SELECT MAX(created_at)
            FROM whatsapp_group_messages msg
            WHERE msg.group_id = g.id
        ) AS last_message_time
    FROM whatsapp_groups g
    WHERE 
        g.created_by = current_user_id
        OR EXISTS (
            SELECT 1 FROM whatsapp_group_members m 
            WHERE m.group_id = g.id 
            AND m.user_id = current_user_id
        )
    ORDER BY last_message_time DESC NULLS LAST;
END;
$$;
