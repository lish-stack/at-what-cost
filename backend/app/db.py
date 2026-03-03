"""
backend/app/db.py

Supabase client setup.
- Use `get_db()` for service-role access (ingestion pipeline, internal endpoints)
- Use `get_user_db(token)` for user-scoped access (RLS enforced for org panel)
"""

import os
from supabase import create_client, Client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# Service role client — bypasses RLS, used by ingestion pipeline and internal endpoints
# NEVER expose this key to the frontend
_service_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Anon client — used as base for user-scoped requests
_anon_client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def get_db() -> Client:
    """
    Returns the service-role Supabase client.
    Use for: ingestion pipeline, /internal/* endpoints, anything that needs
    to write to public tables without a user session.
    """
    return _service_client


def get_user_db(jwt: str) -> Client:
    """
    Returns a Supabase client scoped to the authenticated user's JWT.
    RLS policies are enforced — org users only see their own data.
    Use for: all org panel endpoints, saved companies, notes, reports.
    """
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    client.auth.set_session(jwt, "")
    return client