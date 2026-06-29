/**
 * CHIMES Symposium — default sponsorship email template.
 * Blocks marked fixed stay verbatim; personalize blocks get company-specific research hooks.
 */
const CHIMES_TEMPLATE = {
  id: 'chimes-2026',
  label: 'CHIMES Symposium',
  subjectPersonalize: true,
  suggestedSubject: 'Sponsorship opportunity — CHIMES Symposium (Oct 13, Boston)',

  eventDescription: `CHIMES (Circadian Health Innovations in Medicine, Sleep, and Epidemiology) Symposium — inaugural symposium organized by the Aging Initiative at Harvard College.

Date: Tuesday, October 13th, 3:30PM–7:00PM
Venue: Bornstein Family Amphitheater, Brigham and Women's Hospital, Boston, MA

Audience: Students, graduate students, researchers, clinicians, and industry professionals in circadian biology, sleep medicine, and related biotech.

Confirmed speakers include Dr. Elizabeth Klerman (BWH Sleep & Circadian Medicine), Ed Baker (CPO, WHOOP), and Dr. Olivia Walch (CEO, Arcascope). Additional speakers TBD.

Focus: Bridging basic chronobiology and translational medicine — wearables, first-in-class therapeutics (e.g. Apnimed AD109, Takeda oveporexton), glymphatic system/neurodegeneration, and the circadian biology inflection point.

Organizer: Arthur Tao, Vice President, Aging Initiative (Harvard College student-run nonprofit catalyzing next-gen leaders in biotech and aging research in Boston).`,

  sponsorshipTiers: `[Paste your sponsorship tier PDF contents here — e.g. Gold / Silver / Bronze benefits and costs. Referenced in email as "attached sponsorship tiers."]`,

  blocks: [
    {
      mode: 'personalize',
      label: 'Salutation',
      text: 'Dear [NAME],',
      hint: 'Replace [NAME] with the appropriate contact name when known; otherwise use a sensible generic greeting.',
    },
    {
      mode: 'fixed',
      label: 'Intro — you & CHIMES',
      text: `I hope you are having a fantastic summer! I'm Arthur, a student at Harvard College, where I serve as Vice President with the Aging Initiative, a student-run nonprofit focused on catalyzing the next generation of leaders in biotech and aging research within the Boston ecosystem. As part of our initiative to bring together and connect motivated students and early-career professionals, we are currently organizing our inaugural Circadian Health Innovations in Medicine, Sleep, and Epidemiology (CHIMES) Symposium, which will bring together students, graduate students, researchers, clinicians, and professionals alike to learn from experienced pioneers and leading figures across the world of circadian biology, including Ed Baker (CPO of WHOOP), Dr. Elizabeth Klerman, and [[Fill in with remaining speakers]].`,
    },
    {
      mode: 'personalize',
      label: 'Sponsorship ask + custom hook',
      text: `I'm writing to see if [COMPANY NAME] would be interested in sponsoring the CHIMES Symposium. The event will be held on Tuesday, October 13th, from 3:30PM to 7:00PM in the Bornstein Family Amphitheater at Brigham and Women's Hospital in Boston, MA. [[WRITE CUSTOM HERE]]`,
      hint: 'Replace [COMPANY NAME]. [[WRITE CUSTOM HERE]] = 1–2 sentences tying company mission, recent news, or products to circadian health / sleep / CHIMES audience.',
    },
    {
      mode: 'fixed',
      label: 'Track record',
      text: `CHIMES will build on our success hosting major events such as the Future of Aging (FAR) Mixer which had Kristen Fortney (CEO of BioAge) as the keynote, our Muscle Aging Science and Translation Symposium with speakers such as Andrew Adams (Group VP of Molecule Discovery at Lilly) and David Glass (VP of Research at Regeneron) and our NOVA conference in April, which brought together 600+ attendees and 30+ speakers, such as Ed Boyden and Stuart Lipton, focused on breakthroughs in treatments, modalities, and tools for neurodegenerative diseases. We are also pleased to be bringing fellow former Alnylam CEO, Dr. Maraganore, for our Cardiovascular Aging Research and Development (CARD) Symposium in May 2027.`,
    },
    {
      mode: 'fixed',
      label: 'Confirmed speakers',
      text: `For CHIMES, our confirmed speakers include:
Dr. Elizabeth Klerman: Physician, Division of Sleep and Circadian Medicine, Department of Medicine, Brigham and Women's Hospital; Director, Analytic and Modeling Unit, Division of Sleep and Circadian Disorders, Brigham and Women's Hospital
Ed Baker: Chief Product Officer of WHOOP
Dr. Olivia Walch: Co-founder and CEO of Arcascope`,
    },
    {
      mode: 'fixed',
      label: 'Why circadian / CHIMES mission',
      text: `The motivation for this symposium stems from the fact that circadian biology has reached a critical inflection point. We are witnessing paradigm shifts in both diagnostic capabilities and therapeutic interventions, making this one of the most exciting and untapped frontiers in modern medicine. From the development of first-in-class therapeutics like Apnimed's AD109 and Takeda's oveporexton, to the proliferation of advanced wearables from companies like WHOOP, Fitbit, and Oura, to our deepening understanding of the glymphatic system's role in neurodegeneration, the landscape is evolving rapidly. The CHIMES Symposium brings together students, researchers, clinicians, and industry leaders to bridge the gap between basic chronobiology and translational medicine. We hope this event will spark collaborative action and inspire the next generation of innovators to tackle these crucial global health challenges.`,
    },
    {
      mode: 'fixed',
      label: 'Close',
      text: `I've attached sponsorship tiers as well as costs for the event. Thank you!
Best regards,
Arthur`,
    },
  ],

  /** Full email text for the textarea (blocks joined) */
  fullEmailText() {
    return this.blocks.map(b => b.text).join('\n\n');
  },
};

function applyChimesTemplate() {
  document.getElementById('event-description').value = CHIMES_TEMPLATE.eventDescription;
  document.getElementById('sponsorship-tiers').value = CHIMES_TEMPLATE.sponsorshipTiers;
  document.getElementById('email-template').value = CHIMES_TEMPLATE.fullEmailText();
  document.getElementById('subject-personalize').checked = CHIMES_TEMPLATE.subjectPersonalize;

  state.templateBlocks = CHIMES_TEMPLATE.blocks.map((b, i) => ({
    index: i,
    text: b.text,
    mode: b.mode,
    label: b.label,
    hint: b.hint || '',
  }));

  renderTemplateBlocks();
  localStorage.setItem('event_description', CHIMES_TEMPLATE.eventDescription);
  localStorage.setItem('sponsorship_tiers', CHIMES_TEMPLATE.sponsorshipTiers);
  localStorage.setItem('email_template', CHIMES_TEMPLATE.fullEmailText());
  localStorage.setItem('subject_personalize', String(CHIMES_TEMPLATE.subjectPersonalize));
  localStorage.setItem('template_blocks_json', JSON.stringify(state.templateBlocks));
  localStorage.setItem('template_preset', CHIMES_TEMPLATE.id);

  showStatus('info', `Loaded ${CHIMES_TEMPLATE.label} — 2 personalize blocks (salutation + sponsorship ask), 5 fixed blocks`);
}

function loadDefaultTemplateIfEmpty() {
  const hasTemplate = localStorage.getItem('email_template') || localStorage.getItem('template_blocks_json');
  if (!hasTemplate) applyChimesTemplate();
}
