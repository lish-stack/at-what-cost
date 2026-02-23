from sqlalchemy import Column, Integer, Text, Date, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .db import Base

commitment_type_enum = ENUM(
    'cage_free_eggs',
    name='commitment_type_enum',
    create_type=False
)

compliance_status_enum = ENUM(
    'compliant', 'partial', 'non_compliant', 'unknown',
    name='compliance_status_enum',
    create_type=False
)

event_type_enum = ENUM(
    'pre_deadline', 'deadline', 'post_deadline',
    name='event_type_enum',
    create_type=False
)

source_type_enum = ENUM(
    'report', 'news', 'company_statement',
    name='source_type_enum',
    create_type=False
)

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    website = Column(Text)
    industry = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

    commitments = relationship("Commitment", back_populates="company")


class Commitment(Base):
    __tablename__ = "commitments"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    commitment_type = Column(commitment_type_enum, nullable=False)
    public_statement_url = Column(Text)
    commitment_text = Column(Text)
    announced_date = Column(Date)
    deadline_date = Column(Date)
    current_status = Column(compliance_status_enum, default="unknown")
    created_at = Column(TIMESTAMP, server_default=func.now())

    company = relationship("Company", back_populates="commitments")
    events = relationship("ComplianceEvent", back_populates="commitment")
    evidence_items = relationship("Evidence", back_populates="commitment")


class ComplianceEvent(Base):
    __tablename__ = "compliance_events"

    id = Column(Integer, primary_key=True)
    commitment_id = Column(Integer, ForeignKey("commitments.id"))
    event_type = Column(event_type_enum, nullable=False)
    event_date = Column(Date, nullable=False)
    status = Column(compliance_status_enum, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    commitment = relationship("Commitment", back_populates="events")


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True)
    commitment_id = Column(Integer, ForeignKey("commitments.id"))
    source_url = Column(Text)
    source_type = Column(source_type_enum)
    summary = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

    commitment = relationship("Commitment", back_populates="evidence_items")