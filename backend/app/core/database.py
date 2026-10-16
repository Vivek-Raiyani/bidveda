from urllib.parse import urlsplit, parse_qsl, urlencode, urlunsplit
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings

def get_normalized_database_url(raw_url: str) -> str:
    url = raw_url
    # Normalize scheme for asyncpg
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)

    if "asyncpg" in url:
        parts = urlsplit(url)
        query_params = parse_qsl(parts.query)
        filtered_params = []
        for k, v in query_params:
            # asyncpg does not accept channel_binding
            if k == "channel_binding":
                continue
            # asyncpg expects 'ssl' parameter instead of libpq's 'sslmode'
            if k == "sslmode":
                k = "ssl"
            filtered_params.append((k, v))
        new_query = urlencode(filtered_params)
        url = urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))

    return url

db_url = get_normalized_database_url(settings.DATABASE_URL)

# Neon PgBouncer Pooler & SQLite compatibility:
# 1. SQLite requires check_same_thread=False
# 2. Neon connection pooler (PgBouncer in transaction mode) requires statement_cache_size=0
#    to prevent prepared statement collisions across pooled connections.
connect_args = (
    {"check_same_thread": False}
    if "sqlite" in db_url
    else {"statement_cache_size": 0}
)

engine = create_async_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
)

SessionLocal = async_sessionmaker(
    autocommit=False, autoflush=False, bind=engine, expire_on_commit=False
)
