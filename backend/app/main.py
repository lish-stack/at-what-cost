from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from datetime import date
from .db import SessionLocal
from . import models

app = FastAPI()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/commitments/test")
def create_test_commitment(db: Session = Depends(get_db)):

    company = models.Company(
        name="Whole Foods",
        website="https://wholefoods.com",
        industry="Retail"
    )
    db.add(company)
    db.flush()

    commitment = models.Commitment(
        company_id=company.id,
        commitment_type="cage_free_eggs",
        commitment_text="100% cage-free by 2025",
        announced_date=date(2020, 1, 1),
        deadline_date=date(2025, 1, 1),
        current_status="unknown"
    )

    db.add(commitment)
    db.commit()

    return {"status": "created"}


@app.get("/commitments")
def list_commitments(db: Session = Depends(get_db)):
    commitments = db.query(models.Commitment).all()
    return commitments