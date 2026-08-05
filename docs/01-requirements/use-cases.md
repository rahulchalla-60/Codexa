# Use Cases

## Actors

- Developer
- Tech Lead
- Architect
- DevOps Engineer
- Repository Administrator
- AI Agent
- CI/CD Pipeline

---

# UC-1 Register Repository

Actor:
Developer

Precondition:
Repository exists.

Flow:

1. Register repository.
2. Authenticate.
3. Clone repository.
4. Store metadata.
5. Schedule indexing.

Postcondition:
Repository becomes available.

---

# UC-2 Index Repository

Actor:
Indexing Service

Flow:

1. Detect repository.
2. Parse files.
3. Build AST.
4. Extract symbols.
5. Generate graph.
6. Generate embeddings.
7. Store metadata.

---

# UC-3 Ask AI Question

Actor:
Developer

Flow:

1. Submit question.
2. Retrieve relevant symbols.
3. Retrieve embeddings.
4. Build context.
5. Generate response.
6. Return citations.

---

# UC-4 Repository Change

Actor:
Git Provider

Flow:

1. Push event.
2. Detect changed files.
3. Re-index.
4. Update graph.
5. Update embeddings.

---

# UC-5 Impact Analysis

Actor:
Developer

Flow:

1. Select function.
2. Analyze dependencies.
3. Traverse graph.
4. Identify affected repositories.
5. Display impact report.

---

# UC-6 Cross Repository Query

Actor:
Developer

Flow:

1. Search API.
2. Resolve dependencies.
3. Search linked repositories.
4. Merge context.
5. Generate answer.

---

# UC-7 Documentation Generation

Actor:
Developer

Flow:

1. Select service.
2. Analyze architecture.
3. Generate documentation.
4. Export Markdown.

---

# UC-8 Ownership Lookup

Actor:
Developer

Flow:

1. Select symbol.
2. Resolve CODEOWNERS.
3. Display owning team.
4. Display related repositories.

---

# UC-9 Semantic Search

Actor:
Developer

Flow:

1. Enter query.
2. Perform hybrid retrieval.
3. Rank results.
4. Display code and documentation.

---

# UC-10 Engineering Memory

Actor:
Developer

Flow:

1. Select symbol.
2. Retrieve history.
3. Retrieve related commits.
4. Retrieve linked issues.
5. Display evolution timeline.

---

# UC-11 Automated Pull Request Impact Comment

Actor:
CI/CD Pipeline

Precondition:
Repository is registered and indexed; a pull request is opened or updated.

Flow:

1. CI/CD pipeline notifies Codexa of a new or updated pull request.
2. Review service identifies changed functions, APIs, and modules.
3. Impact service computes blast radius across the dependency graph.
4. Review service posts an automated comment on the pull request summarizing affected repositories and services.
5. Comment links back to the underlying dependency graph evidence.

Postcondition:
Pull request reviewers see blast radius before merge, without requesting it manually.

---

# UC-12 CI/CD Status Check on Impact Threshold

Actor:
CI/CD Pipeline

Flow:

1. CI/CD pipeline requests impact analysis for a pending change as part of the build.
2. Impact service returns blast radius and affected repository count.
3. CI/CD pipeline compares result against a configured threshold.
4. CI/CD pipeline passes, warns, or fails the build status check accordingly.

---

# UC-13 Ownership Drift Detection

Actor:
Repository Administrator

Flow:

1. Ownership service scans CODEOWNERS and equivalent metadata across registered repositories.
2. Ownership service resolves each entry against current team/user records.
3. Ownership service flags entries pointing to nonexistent teams or users, and components with no owner.
4. Repository Administrator reviews the drift report and updates ownership records.

Postcondition:
Ownership metadata across the organization graph stays accurate over time.

---

# UC-14 Feedback on AI Answer

Actor:
Developer

Flow:

1. Developer receives an AI-generated answer with citations and confidence.
2. Developer marks the answer as helpful or unhelpful, optionally with free-text detail.
3. Feedback is stored alongside the retrieval context that produced the answer.
4. Feedback trends are surfaced to administrators for retrieval and grounding evaluation.

---

# UC-15 Deregister Repository

Actor:
Repository Administrator

Precondition:
Repository is currently registered and indexed.

Flow:

1. Administrator selects a repository for removal.
2. Platform confirms the scope of deletion (symbols, graph edges, embeddings, cached AI context).
3. Platform deletes all derived knowledge for the repository.
4. Platform confirms deletion completion to the administrator.

Postcondition:
No knowledge derived from the repository remains queryable.

---

# UC-16 Agent Programmatic Query

Actor:
AI Agent

Precondition:
AI Agent holds a valid, scoped API token.

Flow:

1. AI Agent submits a query via the Codexa API (search, impact analysis, or Q&A).
2. Platform enforces the same access control as for a human user with equivalent permissions.
3. Platform returns results including citations and confidence signals.
4. AI Agent incorporates the result into its own downstream workflow.

Postcondition:
External tools and agents can consume Codexa's knowledge graph under the same trust guarantees as human users.