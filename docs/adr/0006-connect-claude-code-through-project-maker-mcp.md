# Connect Claude Code through Project Maker MCP

Project Maker exposes a VPN-only Streamable HTTP MCP endpoint so each Internal user can work with Projects, Specifications, Delivery packages, the Question Bank, Markdown templates, and the existing preview-confirmed Git handoff from their own Claude Code subscription. The connection uses one self-managed, replaceable Project Maker token per Internal user solely for actor identification; only its digest is stored, there are no roles or scopes, and MCP tools call the existing domain services instead of adding a parallel AI or Git workflow.

**Status:** accepted

**Primary references:** Claude Code supports remote Streamable HTTP servers with static request headers and user scope in its [MCP reference](https://code.claude.com/docs/en/mcp). The model usage remains on the employee's existing [Claude Pro or Max plan](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan), not on a Project Maker model API credential.

**Considered options:** Model-provider API integration would add usage-based credentials and billing; sharing a Claude subscription would mix identities and violate the intended subscription boundary; copy-and-paste prompts would preserve billing but keep the manual handoff the connector is meant to remove; a full OAuth authorization server would add deployment and user-flow complexity without practical benefit inside the Operator's VPN. Customer mail, generic database access, generic filesystem access, and unconfirmed Git writes are deliberately not exposed.

**Consequences:** Project Maker never receives Claude credentials or invokes a model. Every MCP write retains the calling Internal user as audit actor and obeys the same validation and archive rules as the web application. Each user performs a one-time Claude Code connection using their Project Maker token, while replacement or account deactivation invalidates the previous connection. The Git confirmation tool carries Claude Code's `anthropic/requiresUserInteraction` marker, so a fresh human approval remains mandatory even when other Project Maker MCP tools were previously allowed.
