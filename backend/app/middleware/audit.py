"""Audit logging middleware."""
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.models import AuditLog


def log_action(
    db: Session,
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: str = None,
    details: dict = None,
    ip_address: str = None
):
    """Record an audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
        ip_address=ip_address,
        timestamp=datetime.utcnow()
    )
    db.add(entry)
    db.commit()
