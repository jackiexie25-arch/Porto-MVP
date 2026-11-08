import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Banner } from './Banner';
import { Button } from './Button';
import { ChoiceChip } from './Chip';
import { TextField } from './Field';
import { Progress } from './Progress';
import { Sheet } from './Sheet';

describe('Button', () => {
  it('defaults to type=button so it never submits a form by accident', () => {
    render(<Button>Save and continue</Button>);
    expect(screen.getByRole('button', { name: 'Save and continue' })).toHaveAttribute('type', 'button');
  });
});

describe('TextField', () => {
  it('links the hint and error to the input and marks it invalid', () => {
    render(<TextField label="Phone number" hint="Mobile is best." error="Check it has 10 digits." />);
    const input = screen.getByLabelText('Phone number');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/Mobile is best\..*Check it has 10 digits\./);
  });

  it('keeps what was typed when an error is shown', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TextField label="Name" />);
    await user.type(screen.getByLabelText('Name'), 'Ari');
    rerender(<TextField label="Name" error="Please check this." />);
    expect(screen.getByLabelText('Name')).toHaveValue('Ari');
  });
});

describe('ChoiceChip', () => {
  it('exposes its selected state', () => {
    render(<ChoiceChip selected>School</ChoiceChip>);
    expect(screen.getByRole('button', { name: 'School' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Progress', () => {
  it('says which step is current without a percentage', () => {
    render(<Progress current={2} total={6} label="Profile setup" />);
    const nav = screen.getByRole('navigation', { name: 'Profile setup' });
    expect(nav).toHaveTextContent('Step 2 of 6');
    expect(nav).not.toHaveTextContent('%');
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });
});

describe('Banner', () => {
  it('announces politely and labels its icon', () => {
    render(<Banner tone="error">We couldn’t save that.</Banner>);
    expect(screen.getByRole('status')).toHaveTextContent('Needs attention: We couldn’t save that.');
  });
});

function SheetHarness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Sheet
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Did this help?"
      >
        <Button>Yes</Button>
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  it('moves focus in, traps Tab, closes on Escape and returns focus', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SheetHarness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Did this help?' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.tab();
    await user.tab();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
