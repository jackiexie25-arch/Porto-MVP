import { copy } from '../../copy/en-AU';
import { COMMUNICATION_MODES, LIMITS } from '../../data/types';
import type { AboutDraft } from '../../family/drafts';
import { Checkbox, FieldSet, FieldStack, RadioGroup, TextArea, TextField } from '../ui';

const c = copy.setup.about;

export function AboutFields({ draft, onChange }: { draft: AboutDraft; onChange: (draft: AboutDraft) => void }) {
  const name = draft.display_name.trim() || copy.setup.yourChild;
  const set = <K extends keyof AboutDraft>(key: K, value: AboutDraft[K]) => onChange({ ...draft, [key]: value });

  return (
    <FieldStack>
      <TextField
        label={c.nameLabel}
        hint={c.nameHint}
        autoComplete="off"
        maxLength={LIMITS.name}
        value={draft.display_name}
        onChange={(e) => set('display_name', e.target.value)}
      />
      <FieldSet legend={c.modesLegend} hint={c.modesHint}>
        {COMMUNICATION_MODES.map((mode) => (
          <Checkbox
            key={mode}
            label={copy.labels.communication[mode]}
            checked={draft.communication_modes.includes(mode)}
            onChange={(e) =>
              set(
                'communication_modes',
                e.target.checked
                  ? COMMUNICATION_MODES.filter((m) => m === mode || draft.communication_modes.includes(m))
                  : draft.communication_modes.filter((m) => m !== mode),
              )
            }
          />
        ))}
      </FieldSet>
      <TextField
        label={c.languagesLabel}
        hint={c.languagesHint}
        maxLength={LIMITS.languagesText}
        value={draft.languagesText}
        onChange={(e) => set('languagesText', e.target.value)}
      />
      <RadioGroup
        legend={c.styleLegend(name)}
        hint={c.styleHint}
        name="language-style"
        value={draft.language_style}
        options={[
          { value: 'identity_first', label: c.styleIdentity(name) },
          { value: 'person_first', label: c.stylePerson(name) },
        ]}
        onChange={(v) => set('language_style', v)}
      />
      <TextArea
        label={c.connectLabel}
        hint={c.connectHint}
        rows={2}
        maxLength={LIMITS.connectNote}
        value={draft.connect_note}
        onChange={(e) => set('connect_note', e.target.value)}
      />
    </FieldStack>
  );
}
