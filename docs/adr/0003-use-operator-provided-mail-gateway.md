---
status: accepted
---

# Use an Operator organization-provided mail gateway

Project Maker will consume a standard SMTP/IMAP gateway supplied and operated
by the Operator organization. The mail interface will not require Microsoft
Graph, Entra application permissions, tenant-administrator access, or
provider-specific provisioning by the Project Maker supplier. Project
Customers only receive and reply to correspondence; they never supply or
configure the gateway.

Here, Operator organization means the company that receives and operates the
Project Maker application. It does not mean any external Project Customer for
whom that company manages a project.

The current Microsoft Graph transport is a transitional implementation and
must be replaced behind the existing mail seam. Activation evidence will prove
the configured sender, plus-address reply correlation, SMTP submission, IMAP
ingestion, duplicate-safe recovery, and fail-closed behavior using only the
gateway endpoints and credentials supplied by the Operator organization.
