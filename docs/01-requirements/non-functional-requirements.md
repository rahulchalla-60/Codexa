# Non Functional Requirements

## Purpose

Defines quality attributes and operational constraints.

---

# Performance

- Repository indexing shall support repositories containing millions of lines of code.
- Incremental indexing should process only changed files.
- Symbol queries should complete within milliseconds.
- AI retrieval should complete within seconds.
- Embedding generation should be parallelized.

---

# Scalability

- Support thousands of repositories.
- Support millions of symbols.
- Support billions of relationships.
- Support horizontal scaling.
- Support distributed indexing.

---

# Availability

- 99.9% uptime.
- Fault tolerant services.
- Automatic recovery.
- Graceful degradation.

---

# Reliability

- No data corruption.
- Retry failed jobs.
- Idempotent indexing.
- Atomic updates.

---

# Consistency

- Repository graph and vector index remain synchronized.
- Eventual consistency between services.
- Strong consistency for metadata updates.

---

# Maintainability

- Modular architecture.
- Service isolation.
- Versioned APIs.
- Clear ownership boundaries.

---

# Extensibility

- Plugin-based language parsers.
- Plugin embedding models.
- Plugin vector databases.
- Plugin repository providers.

---

# Security

- Role-based access control.
- Repository isolation.
- Encrypted credentials.
- Audit logs.

---

# Observability

- Metrics
- Logging
- Distributed tracing
- Health checks
- Alerting

---

# Portability

- Docker deployment
- Kubernetes deployment
- Cloud agnostic
- Local deployment

---

# Recoverability

- Automatic backups
- Restore support
- Re-index capability
- Disaster recovery

---

# Compatibility

- GitHub
- GitLab
- Bitbucket
- Local repositories
- Monorepos
- Polyrepos

---

# Data Privacy and Compliance

- No knowledge shall be surfaced beyond a user's underlying repository access.
- Secrets and credentials shall never persist in indexed content, embeddings, or logs.
- Data residency shall match the residency constraints of the source repository.
- The platform shall support audit export sufficient for SOC 2-style compliance review.
- The platform shall support full data deletion on repository deregistration (see FR-21).

---

# Cost and Resource Efficiency

- Indexing cost shall scale sub-linearly with repository count where possible (shared infrastructure, batched embedding calls).
- Unchanged content shall never be re-embedded or re-analyzed.
- Compute cost per indexed repository shall be tracked and reportable per team/org unit.
- AI query cost shall be boundable via configurable quotas.

---

# Testability

- Deterministic components (parsing, graph construction) shall have reproducible, automatable regression tests.
- AI-grounded answers shall be evaluable against a maintained regression suite of known-correct question/answer pairs.
- Retrieval precision and recall shall be measurable independently of the language model's output quality.

---

# Usability

- AI answers shall be presented with visible citations and confidence, not as unqualified assertions.
- Common queries (search, impact analysis, ownership lookup) shall be reachable within a small, consistent number of interactions.
- Error and low-confidence states shall be communicated clearly rather than silently degraded.