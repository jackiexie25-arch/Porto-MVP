import { useMemo } from 'react';
import { copy } from '../copy/en-AU';
import { usePageTitle } from '../lib/usePageTitle';
import { WorkerView } from '../worker/WorkerView';
import { demoSource } from './demoSource';
import styles from './Demo.module.css';

/** /demo: the worker view with the fictional Ari profile. No sign-in, no share link, nothing sent. */
export default function DemoPage() {
  const source = useMemo(() => demoSource(), []);
  usePageTitle(copy.demo.title);
  return (
    <WorkerView
      source={source}
      demoNote={
        <p className={styles.note} role="note">
          <strong>{copy.demo.label}</strong> {copy.demo.nothingSent}
        </p>
      }
    />
  );
}
