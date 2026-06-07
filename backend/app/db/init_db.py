from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.password_reset import PasswordResetCode

DEFAULT_DEPARTMENTS = [
    ("IT Support Documents", "Technical support documentation and guides"),
    ("Store Documents", "Store operations and inventory documentation"),
    ("Automation Documents", "Automation systems and process documentation"),
    ("Maintenance Documents", "Maintenance schedules and equipment manuals"),
    ("Accounts Documents", "Financial and accounting documentation"),
    ("HR Documents", "Human resources policies and employee records"),
]


def seed_departments(db: Session) -> list[Department]:
    created: list[Department] = []
    for name, description in DEFAULT_DEPARTMENTS:
        existing = db.query(Department).filter(Department.name == name).first()
        if existing:
            created.append(existing)
            continue
        dept = Department(name=name, description=description)
        db.add(dept)
        created.append(dept)
    db.commit()
    for dept in created:
        db.refresh(dept)
    return created


def ensure_user_profile_columns(db: Session) -> None:
    inspector = inspect(db.bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "phone_number" not in columns:
        db.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR(50)"))
    if "profile_picture" not in columns:
        db.execute(text("ALTER TABLE users ADD COLUMN profile_picture TEXT"))
    db.commit()


def ensure_password_reset_table(db: Session) -> None:
    PasswordResetCode.__table__.create(bind=db.bind, checkfirst=True)
