"""Action Items router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.models import ActionItem, ActionStatus, Meeting, User
from app.schemas import ActionItemOut, ActionItemUpdate
from app.middleware.auth import get_current_user
from app.middleware.audit import log_action

router = APIRouter(tags=["Action Items"])


@router.get("/meetings/{meeting_id}/actions", response_model=List[ActionItemOut])
async def get_meeting_actions(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    items = (
        db.query(ActionItem)
        .filter(ActionItem.meeting_id == meeting_id)
        .order_by(ActionItem.deadline.asc().nullslast())
        .all()
    )
    return [ActionItemOut.model_validate(i) for i in items]


@router.put("/actions/{action_id}", response_model=ActionItemOut)
async def update_action_item(
    action_id: str,
    update: ActionItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(ActionItem).filter(ActionItem.id == action_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Action item not found")

    if update.status:
        item.status = ActionStatus(update.status)
    if update.notes is not None:
        item.notes = update.notes
    if update.deadline is not None:
        item.deadline = update.deadline
    if update.priority is not None:
        item.priority = update.priority

    db.commit()
    db.refresh(item)
    log_action(db, current_user.id, "UPDATE", "action_item", action_id)
    return ActionItemOut.model_validate(item)


@router.get("/actions/dashboard", response_model=List[ActionItemOut])
async def actions_dashboard(
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """All pending actions across all meetings."""
    query = db.query(ActionItem)
    if status:
        query = query.filter(ActionItem.status == status)
    else:
        # Default: non-completed
        query = query.filter(ActionItem.status != ActionStatus.COMPLETED)
    items = query.order_by(ActionItem.deadline.asc().nullslast()).all()
    return [ActionItemOut.model_validate(i) for i in items]
