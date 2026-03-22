_initialized_tables: set[str] = set()
_bootstrap_ready = False


def is_initialized(name: str) -> bool:
    return name in _initialized_tables


def mark_initialized(name: str) -> None:
    _initialized_tables.add(name)


def mark_bootstrap_ready() -> None:
    global _bootstrap_ready
    _bootstrap_ready = True


def bootstrap_ready() -> bool:
    return _bootstrap_ready
