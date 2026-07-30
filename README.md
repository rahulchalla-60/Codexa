# Codexa
An Engineering Memory Platform that parses codebases into a dependency graph to proactively detect breaking changes and correlate past incidents directly on Pull Requests.


# Engineering Memory Platform 

Every growing engineering team has a massive, invisible graph of dependencies hidden inside their codebase. Knowledge of which services call which, which APIs are relied on, and which changes are "landmines" usually only exists in the heads of senior engineers.

This project is an **Engineering Memory Platform**. It parses a company's codebase and deployment history into a structured graph, then uses that graph to answer one question flawlessly: 
> *"If I change this, what breaks, and has it broken before?"*

### Core Features
*   **Cross-Repo Dependency Graph:** Uses `Tree-sitter` and PostgreSQL (via Recursive CTEs) to track functions, endpoints, and API calls across multiple isolated repositories.
*   **Proactive Blast-Radius Detection:** A GitHub App integration that diffs Pull Requests against the dependency graph to find all downstream consumers affected by a change.
*   **Incident Memory:** Correlates historical production incidents (from Jira/PagerDuty) to the exact code paths being modified to prevent repeating past mistakes.
*   **AI-Powered PR Insights:** Uses edge LLMs to turn complex graph traversals into simple, plain-English risk warnings directly on GitHub PRs.
