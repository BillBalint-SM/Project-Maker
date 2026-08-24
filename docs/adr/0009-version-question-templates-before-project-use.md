# Version Question Templates before Project use

Question Templates use one editable draft and immutable published versions, while an applied Project question schema remains a separate immutable snapshot of the then-current Published Question Bank version. Project schemas retain template id, name, and version provenance; templates retain stable keys and required/blocking overrides rather than copying Question Bank text, so future Projects receive current published question content without rewriting earlier schemas.

**Status:** accepted

**Considered options:** A mutable saved checkbox list would be simpler but could not explain which selection a Project used. Copying full question content into templates would duplicate the Question Bank and create two competing sources. Treating a template itself as a Project schema would mix organization policy with Project-owned history.

**Consequences:** A template must be published before application. Publishing or application fails if a selected stable key is missing or inactive in the latest Question Bank. Manual Project schema selection remains supported without template provenance, and changing a template never changes an existing Project schema or interview.
