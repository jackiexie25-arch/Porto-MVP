import { copy } from '../copy/en-AU';
import { CONSENT_VERSION } from '../lib/consent';
import { config } from '../lib/config';
import styles from './PrivacyDetails.module.css';

const c = copy.privacy;

/** The plain-language privacy text. Shown on /privacy and on the consent screen. */
export function PrivacyDetails({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className={styles.details}>
      {c.sections.map((section) => (
        <section key={section.heading} className={styles.section}>
          <Heading className="t-h3">{section.heading}</Heading>
          <ul className={styles.list}>
            {section.body.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
      <p>{config.privacyContactEmail ? c.contact(config.privacyContactEmail) : c.contactMissing}</p>
      <p>
        <strong>{c.emergency}</strong>
      </p>
      <p className="t-small t-muted">{c.version(CONSENT_VERSION)}</p>
    </div>
  );
}
