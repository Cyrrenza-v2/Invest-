# Invest-broker — Slack AI Workflow Integration (Phase 1)

Phase 1 provides **two independent Slack Workflow Builder steps**:

1. **Answer with AI** — answer a question using optional user-supplied context.
2. **Analyze GitHub Build Failure** — retrieve a GitHub Actions run and its jobs, then summarize likely causes and next debugging steps with AI.

The static preview is in `web/index.html`. It is a UI preview only and does not call the AI service from the browser.

## Requirements

- Slack CLI and a workspace/plan that supports custom workflow steps. Slack documents that custom workflow steps cannot be developed on the Free plan.
- Deno / Slack CLI project support.
- `OPENAI_API_KEY` stored as a Slack app secret.
- For GitHub Actions failure analysis, optionally store `GITHUB_TOKEN` as a Slack app secret. A token is recommended for private repositories and API rate limits; never paste tokens into workflow inputs.

## Setup and deploy to Slack

1. Install and authenticate the Slack CLI: `slack login`.
2. From this directory, run `slack run` to validate the app in a development workspace.
3. Configure the secrets in the Slack app secret store:
   - `slack secrets add OPENAI_API_KEY <your-key>`
   - Optional: `slack secrets add GITHUB_TOKEN <your-token>`
4. Run `slack deploy`.
5. In Workflow Builder, add either **Answer with AI** or **Analyze GitHub Build Failure** and map the inputs.

## GitHub build analysis inputs

- `repository`: `owner/repo`, for example `Cyrrenza-v2/Invest-broker`.
- `run_id`: numeric GitHub Actions workflow run ID from the failed run URL.

The function fetches the run metadata and jobs from GitHub's REST API. It only reads build information; it does not re-run workflows, change source code, or push commits.

## Security

- API keys are read only from the runtime secret store.
- Inputs have length checks; answer length is bounded.
- No Slack message-history scopes are requested.
- No investment records, balances, deposits, withdrawals, or trading actions are accessed.
- Do not send confidential logs or customer data unless approved by your organization.

## Web preview

The web preview is a static product preview and does not embed credentials or make API calls. GitHub Pages deployment uses the repository's GitHub Actions workflow and requires Pages to be enabled with **Settings → Pages → Source: GitHub Actions**.

## Verification status

Source files are committed on a feature branch and proposed in a draft PR. Slack deployment requires an authorized Slack CLI session and configured secrets. The static preview becomes public only after the PR is merged, Pages is enabled, and the GitHub Pages workflow succeeds.
