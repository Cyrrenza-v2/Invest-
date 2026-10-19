# Invest-broker — Slack Workflow Integration (Phase 1)

Phase 1 provides **three independent Slack Workflow Builder steps**:

1. **Answer with AI** — answer a question using optional user-supplied context.
2. **Analyze GitHub Build Failure** — retrieve a GitHub Actions run and its jobs, then summarize likely causes and next debugging steps with AI.
3. **Review Workspace Access CSV** — parse a Slack member export and flag MFA/SSO gaps, owner-level roles, and optional billing/expiry fields for human follow-up. The report uses CSV row numbers only and intentionally omits member names, emails, and IDs.

The static preview is in `web/index.html`. It is a UI preview only and does not call the AI service from the browser.

## Requirements

- Slack CLI and a workspace/plan that supports custom workflow steps. Slack custom workflow steps may not be available on the Free plan.
- Deno / Slack CLI project support.
- `OPENAI_API_KEY` stored as a Slack app secret for the two AI-backed steps.
- For GitHub Actions failure analysis, optionally store `GITHUB_TOKEN` as a Slack app secret. A token is recommended for private repositories and API rate limits; never paste tokens into workflow inputs.

## Setup and deploy to Slack

1. Install and authenticate the Slack CLI: `slack login`.
2. From this directory, run `slack run` to validate the app in a development workspace.
3. Configure secrets in the Slack app secret store:
   - `slack secrets add OPENAI_API_KEY <your-key>`
   - Optional: `slack secrets add GITHUB_TOKEN <your-token>`
4. Run `deno task check` to type-check the workflow source.
5. Run `slack deploy` after validation.
6. In Workflow Builder, add the required step and map its inputs.

## GitHub build analysis inputs

- `repository`: `owner/repo`, for example `Cyrrenza-v2/Invest-broker`.
- `run_id`: numeric GitHub Actions workflow run ID from the failed run URL.

The function fetches run metadata and jobs from GitHub's REST API. It only reads build information; it does not re-run workflows, change source code, or push commits.

## Workspace access CSV review

Paste the CSV export into the **Review Workspace Access CSV** workflow input. The step requires the `status`, `has-2fa`, and `has-sso` columns. It supports up to 100 KB and 1,000 member rows. If present, `billing-active` and `expiration-timestamp` are also reviewed.

- The report deliberately avoids member names, emails, and user IDs.
- A missing/false field is a review flag, not proof of a misconfiguration; exports can omit data.
- Owner-level roles are highlighted for a least-privilege check, not automatically treated as malicious.
- No access is changed and no member is removed. Verify findings in Slack admin settings and perform any access changes separately.
- Do not commit real workspace member exports to the repository. Treat exports as sensitive operational data.

## Security

- API keys are read only from the runtime secret store.
- Inputs have size checks; AI answer length is bounded.
- No Slack message-history scopes are requested.
- The access review is an offline CSV analysis; it does not claim to verify live Slack settings.
- No investment records, balances, deposits, withdrawals, or trading actions are accessed.
- Do not send confidential logs or customer data unless approved by your organization.

## Web preview

The web preview is a static product preview and does not embed credentials or make API calls. GitHub Pages deployment uses the repository's GitHub Actions workflow and requires Pages to be enabled with **Settings → Pages → Source: GitHub Actions**.

## Verification status

Source changes are committed on a feature branch. Slack deployment requires an authorized Slack CLI session and configured secrets. The static preview becomes public only after the relevant changes are merged, Pages is enabled, and the GitHub Pages workflow succeeds.
