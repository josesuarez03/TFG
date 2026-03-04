from services.auth.auth import get_user_id_from_token


def resolve_ws_user_id(data, sid, authenticated_users_by_sid, allow_anonymous: bool = False):
    user_id = None
    auth_source = None
    token_from_payload = data.get("token")

    if token_from_payload:
        user_id = get_user_id_from_token(token_from_payload)
        if user_id:
            auth_source = "token_payload"

    if not user_id:
        user_id = authenticated_users_by_sid.get(sid)
        if user_id:
            auth_source = "socket_connect_auth"

    if not user_id:
        user_id_from_data = data.get("user_id")
        if user_id_from_data:
            user_id = user_id_from_data
            auth_source = "payload_user_id_fallback"

    if not user_id and allow_anonymous:
        user_id = f"anonymous_{sid}"
        auth_source = "anonymous_sid_fallback"

    return user_id, auth_source


def resolve_ws_leave_user_id(data, sid, authenticated_users_by_sid):
    user_id = authenticated_users_by_sid.get(sid)
    if user_id:
        return user_id
    token_from_payload = data.get("token")
    if token_from_payload:
        user_id = get_user_id_from_token(token_from_payload)
        if user_id:
            return user_id
    return data.get("user_id")
