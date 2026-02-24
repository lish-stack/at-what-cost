# backend/app/schemas.py

from pydantic import BaseModel
from datetime import date
from enum import Enum
from typing import Optional


class CommitmentType(str, Enum):
    cage_free_eggs = "cage_free_eggs"


class ComplianceStatus(str, Enum):
    compliant = "compliant"
    partial = "partial"
    non_compliant = "non_compliant"
    unknown = "unknown"


class EventType(str, Enum):
    pre_deadline = "pre_deadline"
    deadline = "deadline"
    post_deadline = "post_deadline"


class SourceType(str, Enum):
    report = "report"
    news = "news"
    company_statement = "company_statement"


class CompanyCreate(BaseModel):
    name: str
    website: Optional[str] = None
    industry: Optional[str] = None


class CommitmentCreate(BaseModel):
    company: CompanyCreate
    commitment_type: CommitmentType
    commitment_text: str
    announced_date: date
    deadline_date: date
    public_statement_url: Optional[str] = None


class ComplianceEventCreate(BaseModel):
    event_type: EventType
    event_date: date
    status: ComplianceStatus
    update_commitment_status: Optional[bool] = False


class EvidenceCreate(BaseModel):
    source_url: str
    source_type: SourceType
    summary: str