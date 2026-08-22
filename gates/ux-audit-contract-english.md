# Gates: UX audit optional-resource contract and professional English

Scope: resolve UX-AUDIT-005 and UX-AUDIT-006 without weakening real missing-resource or mutation guards.

- [x] G1: Known Projects with no Question Schema or Delivery Package return successful JSON null, while unknown Projects remain 404.
  CHECK: rg -n "returns null" apps/api/test/question-bank-reference-files.e2e-spec.ts apps/api/test/delivery-package.e2e-spec.ts
  EXPECT: /null|200/
  EVIDENCE: apps/api/test/delivery-package.e2e-spec.ts:57:  it('returns null with 200 when no Delivery Package exists for a known Project and 404 for a missing Project', async () => { | apps/api/test/question-ban

- [x] G2: Focused API contract tests pass for both optional-resource reads.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/api test:compile && node --test --test-concurrency=1 --test-name-pattern="returns null with 200" ./apps/api/dist-test/test/question-bank-reference-files.e2e-spec.js ./apps/api/dist-test/test/delivery-package.e2e-spec.js
  EXPECT: /fail 0/
  EVIDENCE: npm notice run pnpm --dir apps/api test:compile | $ node -e "require('node:fs').rmSync('dist-test',{recursive:true,force:true})" && tsc --project ./test/tsconfig.json

- [x] G3: Browser adapters consume the successful nullable contract and no longer reinterpret expected 404 as null.
  CHECK: rg -n "loadProjectSchema|loadPackage" apps/web/src/app/settings/question-bank-api.service.ts apps/web/src/app/projects/delivery/delivery-api.service.ts
  EXPECT: loadPackage
  EVIDENCE: apps/web/src/app/projects/delivery/delivery-api.service.ts:18:  loadPackage(projectId: string): Observable<DeliveryPackage | null> { | apps/web/src/app/settings/question-bank-api.service.ts:58:  loadP

- [x] G4: Git setup, Project contact, and Insight fallback failures are complete actionable professional English.
  CHECK: rg -n "save the Git setup|save the Project contact|save the Insight" apps/web/src/app/projects/delivery/delivery-api.service.ts apps/web/src/app/projects/discovery/discovery-api.service.ts
  EXPECT: save the Git setup
  EVIDENCE: apps/web/src/app/projects/discovery/discovery-api.service.ts:41:      .pipe(catchError((error: unknown) => fail(error, 'save the Insight'))); | apps/web/src/app/projects/delivery/delivery-api.service.

- [x] G5: Focused web adapter copy/contract specifications pass.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/web exec ng test --watch=false --include=src/app/projects/delivery/delivery-api.service.spec.ts --include=src/app/projects/discovery/discovery-api.service.spec.ts --include=src/app/settings/question-bank-api.service.spec.ts
  EXPECT: /[1-9][0-9]* passed/
  EVIDENCE: npm notice run project-maker@0.2.0 npx | npm notice run pnpm --dir apps/web exec ng test --watch=false --include=src/app/projects/delivery/delivery-api.service.spec.ts --include=src/app/projects/disco

- [x] G6: The Delivery side-panel title is the professional-English `Outputs`, not the confirmed Hungarian literal.
  CHECK: node -e "const s=require('node:fs').readFileSync('apps/web/src/app/projects/delivery/delivery.page.html','utf8');if(!s.includes('<ng-template #title>Outputs</ng-template>')||s.includes('Kimenetek'))process.exit(1);console.log('Delivery side-panel title is Outputs')"
  EXPECT: Delivery side-panel title is Outputs
  EVIDENCE: Delivery side-panel title is Outputs

- [x] G7: Current operating documentation no longer declares Hungarian as the employee UI/output standard.
  CHECK: node -e "const fs=require('node:fs');const files=['README.md','CONTEXT.md','docs/roadmap.md','docs/user-guide.md','docs/adr/0007-command-local-pending-state.md'];const re=/Hungarian end-user guide|Hungarian UI states|Hungarian-safe|Hungarian business-functional|Hungarian user-facing copy|felülete magyar|actionable Hungarian message|Employee-facing language\s*\n?calls the role `Ügyfélkapcsolattartó`|employee-facing name is\s*\n?`Projektportfólió`|employee-facing name is `Aktív munkasor`|Selected project context: Projektállapot/i;const hits=files.flatMap(f=>fs.readFileSync(f,'utf8').split(/\r?\n/).flatMap((line,i)=>re.test(line)?[f+':'+(i+1)+':'+line]:[]));if(hits.length){console.error(hits.join('\n'));process.exit(1)}console.log('No obsolete Hungarian UI standard')"
  EXPECT: No obsolete Hungarian UI standard
  EVIDENCE: No obsolete Hungarian UI standard

- [x] G8: Red-first proof exists for the nullable HTTP contract and all four confirmed language literals before implementation changes.
  EVIDENCE: Red proof: after migrations, the two new API contract tests failed with `{} !== null`; implementation then changed controller responses to `response.json(...)`. Adapter/copy assertions were added before their fallback replacements.
