const concepts = [
  {
    key: 'ledger',
    letter: 'A',
    name: 'Decision Ledger',
    concept:
      'A Projectek szerkesztett napi munkanaplóként jelennek meg: dashboard helyett egy folyamatos, olvasásra komponált döntési sorrend vezeti a figyelmet.',
    direction:
      'Világos Newsprint-világ, újság-masthead, erős tipográfiai hierarchia, hajszálvékony elválasztók és kizárólag szöveges elsődleges műveletek.',
    motivation:
      'Csökkenti a dashboard-fáradtságot, és a kártyák helyett a projekt történetét, állapotát és következő döntését teszi elsődlegessé.',
    opportunity:
      'Komoly szerkesztőségi és tanácsadói karaktert ad; vezetői átfutáshoz, döntési naplóhoz és nyomtatott vagy PDF-nézethez is erős alap.',
    tradeoff:
      'Nagy mennyiségű projekt párhuzamos operatív triázsa lassabb, és kevésbé érzékelteti térben a preparation journey előrehaladását.',
  },
  {
    key: 'journey',
    letter: 'B',
    name: 'Journey Field',
    concept:
      'Maga a Project preparation journey válik navigációvá: a Projectek állapotcsomópontok, a kiválasztás pedig azonnal megmutatja az egyetlen következő műveletet.',
    direction:
      'Sötét, filmszerű térkép, Command Palette, szemantikusan színezett csomópontok és kevés, irányt jelző mozgás.',
    motivation:
      'A „magába szippantó” élményt nem dekoratív animációval, hanem térbeli tájékozódással és felfedezhető útvonallal teremti meg.',
    opportunity:
      'Nagyon erős onboarding- és journey-magyarázó felület; a kiválasztott Project később természetesen nagyítható saját munkatérbe.',
    tradeoff:
      'A reszponzív, billentyűzetes és akadálymentes megvalósítása összetettebb; a power userek egy része gyorsabbnak érezhet egy táblázatot.',
  },
  {
    key: 'quiet',
    letter: 'C',
    name: 'Quiet Workshop',
    concept:
      'Egyetlen aktuális Project és következő művelet uralja a bal oldalt, míg a kapcsolódó munka rendezett, visszafogott listaként marad elérhető.',
    direction:
      'Meleg papír és mélyzöld, minimális peremnavigáció, Split Studio elrendezés és halk keresztfade-ek.',
    motivation:
      'Hosszú fókuszidőre és alacsonyabb kognitív terhelésre optimalizál: a felület nem sürget, hanem segít befejezni a következő értelmes lépést.',
    opportunity:
      'Nyugodt, prémium és professzionális termékszemélyiséget ad; interjúkhoz, formokhoz és mély projektmunkához különösen jó.',
    tradeoff:
      'Portfóliószintű triázsra kevésbé alkalmas, a globális információs architektúra pedig szándékosan kevésbé látható.',
  },
  {
    key: 'ops',
    letter: 'D',
    name: 'Ops Grid',
    concept:
      'Egy power-user operációs műszerfal: minden cella egy munkafeladatot, állapotot vagy várakozó döntést képvisel, sűrű és gyorsan pásztázható rendszerben.',
    direction:
      'Sötét Terminal-esztétika, oldalrail, aszimmetrikus Bento Grid, tabuláris adatok és azonnali állapotjelzés.',
    motivation:
      'A lehető legnagyobb átfutási sebességet és információs sűrűséget célozza napi PMO- és operációs használathoz.',
    opportunity:
      'Erős napi kezdőképernyő lehet haladó felhasználóknak, billentyűparancsokkal, mentett nézetekkel és valós idejű queue-kezeléssel.',
    tradeoff:
      'Meredekebb tanulási görbéje lehet, alkalmi felhasználóknak ridegnek tűnhet, mobilon pedig külön kompozíciós logikát kíván.',
  },
  {
    key: 'play',
    letter: 'E',
    name: 'Project Playground',
    concept:
      'A következő műveletek barátságos, fizikainak ható munkaobjektumok; a felhasználó projektek és preparation kontextusok között is böngészhet.',
    direction:
      'Krém alapú, többakcentes Hum-paletta, brutális slab navigáció, lekerekített formák, saját karakter és reszponzív, tapintható mozgás.',
    motivation:
      'Megközelíthetőbbé és élőbbé teszi a komoly domainmunkát anélkül, hogy elrejtené a Projectek valós állapotát vagy a következő műveletet.',
    opportunity:
      'Kiemelkedő onboardingot, használati kedvet és megjegyezhető márkaidentitást teremthet; a program „egyénisége” itt a legerősebb.',
    tradeoff:
      'Konzervatív operációs környezetben túl informális lehet, és szigorú szemantikus színhasználat kell, hogy a játékosság ne okozzon félreértést.',
  },
];

const nodeDetails = {
  'Supplier Onboarding · Continue Initial Intake': {
    title: 'Supplier Onboarding',
    state: 'Initial Intake in progress',
    action: 'Continue Initial Intake',
    message: 'Opening Initial Intake.',
  },
  'Customer Portal Renewal · Classify Customer replies': {
    title: 'Customer Portal Renewal',
    state: 'Clarification required',
    action: 'Classify Customer replies',
    message: 'Opening Customer reply classification.',
  },
  'Field Service Mobile · Complete Decision Review': {
    title: 'Field Service Mobile',
    state: 'Decision Review required',
    action: 'Complete Decision Review',
    message: 'Opening Decision Review.',
  },
  'ERP Reporting Refresh · Resolve the remaining gap': {
    title: 'ERP Reporting Refresh',
    state: 'Ready for estimation preparation',
    action: 'Resolve the remaining gap',
    message: 'Opening Estimation Readiness.',
  },
};

const sections = [...document.querySelectorAll('[data-prototype]')];
const previousButton = document.querySelector('#variant-previous');
const nextButton = document.querySelector('#variant-next');
const infoButton = document.querySelector('#variant-info');
const conceptDialog = document.querySelector('#concept-dialog');
const skipLink = document.querySelector('#skip-link');
const positionLabel = document.querySelector('#variant-position');
const nameLabel = document.querySelector('#variant-name');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const announcer = document.querySelector('#prototype-announcer');

const conceptFields = {
  position: document.querySelector('#concept-dialog-position'),
  title: document.querySelector('#concept-dialog-title'),
  concept: document.querySelector('#concept-dialog-concept'),
  direction: document.querySelector('#concept-dialog-direction'),
  motivation: document.querySelector('#concept-dialog-motivation'),
  opportunity: document.querySelector('#concept-dialog-opportunity'),
  tradeoff: document.querySelector('#concept-dialog-tradeoff'),
};

let currentIndex = 0;

function isEditableTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.matches('input, textarea, select, [contenteditable="true"]') || target.isContentEditable)
  );
}

function closeOpenDialogs() {
  document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
}

function updateConceptDialog(concept) {
  const position = `${concept.letter} / ${concepts.length}`;
  conceptFields.position.textContent = position;
  conceptFields.title.textContent = concept.name;
  conceptFields.concept.textContent = concept.concept;
  conceptFields.direction.textContent = concept.direction;
  conceptFields.motivation.textContent = concept.motivation;
  conceptFields.opportunity.textContent = concept.opportunity;
  conceptFields.tradeoff.textContent = concept.tradeoff;
}

function activateVariant(
  index,
  { updateHistory = true, announce = true, focusHeading = false } = {},
) {
  currentIndex = (index + concepts.length) % concepts.length;
  const concept = concepts[currentIndex];

  closeOpenDialogs();
  sections.forEach((section) => {
    section.hidden = section.dataset.prototype !== concept.key;
  });

  document.body.dataset.activePrototype = concept.key;
  const activeHeading = sections.find((section) => !section.hidden)?.querySelector('h1');
  activeHeading?.setAttribute('tabindex', '-1');
  skipLink.href = `#${activeHeading.id}`;
  positionLabel.textContent = `${concept.letter} / ${concepts.length}`;
  nameLabel.textContent = concept.name;
  updateConceptDialog(concept);

  if (updateHistory) {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', concept.key);
    window.history.replaceState({ variant: concept.key }, '', url);
  }

  window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  if (focusHeading) {
    activeHeading?.focus({ preventScroll: true });
  }
  if (announce) {
    announcer.textContent = `${concept.letter}. ${concept.name} design direction selected.`;
  }
}

function resolveInitialIndex() {
  const requested = new URL(window.location.href).searchParams.get('variant')?.toLowerCase();
  const byKey = concepts.findIndex((concept) => concept.key === requested);
  if (byKey >= 0) return byKey;

  const byLetter = concepts.findIndex((concept) => concept.letter.toLowerCase() === requested);
  return byLetter >= 0 ? byLetter : 0;
}

previousButton.addEventListener('click', () => activateVariant(currentIndex - 1));
nextButton.addEventListener('click', () => activateVariant(currentIndex + 1));
infoButton.addEventListener('click', () => conceptDialog.showModal());

document.addEventListener('keydown', (event) => {
  if (isEditableTarget(event.target)) return;

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    if (concepts[currentIndex].key !== 'journey') return;
    event.preventDefault();
    const palette = document.querySelector('#journey-palette');
    palette.showModal();
    window.requestAnimationFrame(() => document.querySelector('#journey-search')?.focus());
    return;
  }

  if (document.querySelector('dialog[open]')) return;

  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    activateVariant(currentIndex - 1, { focusHeading: true });
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    activateVariant(currentIndex + 1, { focusHeading: true });
  }
});

document.querySelectorAll('[data-open-dialog]').forEach((button) => {
  button.addEventListener('click', () => {
    const dialog = document.querySelector(`#${button.dataset.openDialog}`);
    dialog?.showModal();
    window.requestAnimationFrame(() => dialog?.querySelector('input')?.focus());
  });
});

document.querySelectorAll('[data-select-node]').forEach((button) => {
  button.addEventListener('click', () => {
    const details = nodeDetails[button.dataset.selectNode];
    if (!details) return;

    document.querySelectorAll('[data-select-node]').forEach((node) => {
      node.setAttribute('aria-pressed', String(node === button));
    });

    document.querySelector('#journey-selection-title').textContent = details.title;
    document.querySelector('#journey-selection-state').textContent = details.state;
    const actionButton = document.querySelector('#journey-selection-action');
    actionButton.firstChild.textContent = `${details.action} `;
    actionButton.dataset.demoMessage = details.message;
    announcer.textContent = `${details.title}. ${details.state}. Next action: ${details.action}.`;
  });
});

document.querySelectorAll('[data-demo-message]').forEach((button) => {
  button.addEventListener('click', () => {
    announcer.textContent = button.dataset.demoMessage;
    button.dataset.state = 'success';
    window.setTimeout(() => {
      delete button.dataset.state;
    }, reduceMotion.matches ? 150 : 900);
  });
});

document.querySelectorAll('[data-star]').forEach((button) => {
  button.addEventListener('click', (event) => {
    if (reduceMotion.matches) return;

    const playSection = document.querySelector('[data-prototype="play"]');
    const buttonRect = button.getBoundingClientRect();
    const originX = event.detail === 0 ? buttonRect.left + buttonRect.width / 2 : event.clientX;
    const originY = event.detail === 0 ? buttonRect.top + buttonRect.height / 2 : event.clientY;
    const burst = document.createElement('span');
    burst.className = 'star-burst';
    burst.setAttribute('aria-hidden', 'true');
    burst.style.left = `${originX}px`;
    burst.style.top = `${originY}px`;
    playSection.append(burst);
    burst.addEventListener('animationend', () => burst.remove(), { once: true });
  });
});

window.addEventListener('popstate', () => {
  activateVariant(resolveInitialIndex(), { updateHistory: false });
});

activateVariant(resolveInitialIndex(), { updateHistory: false, announce: false });
