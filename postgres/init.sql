-- enums
CREATE TYPE commitment_type_enum AS ENUM ('cage_free_eggs');
CREATE TYPE compliance_status_enum AS ENUM ('compliant', 'partial', 'non_compliant', 'unknown');
CREATE TYPE event_type_enum AS ENUM ('pre_deadline', 'deadline', 'post_deadline');
CREATE TYPE source_type_enum AS ENUM ('report', 'news', 'company_statement');

-- companies
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- commitments
CREATE TABLE commitments (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  commitment_type commitment_type_enum NOT NULL,
  public_statement_url TEXT,
  commitment_text TEXT,
  announced_date DATE,
  deadline_date DATE,
  current_status compliance_status_enum DEFAULT 'unknown',
  created_at TIMESTAMP DEFAULT NOW()
);

-- compliance events
CREATE TABLE compliance_events (
  id SERIAL PRIMARY KEY,
  commitment_id INTEGER REFERENCES commitments(id),
  event_type event_type_enum NOT NULL,
  event_date DATE NOT NULL,
  status compliance_status_enum NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- evidence
CREATE TABLE evidence (
  id SERIAL PRIMARY KEY,
  commitment_id INTEGER REFERENCES commitments(id),
  source_url TEXT,
  source_type source_type_enum,
  summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- decision makers
CREATE TABLE decision_makers (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  name TEXT,
  role TEXT,
  contact_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
