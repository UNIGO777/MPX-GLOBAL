import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { Modal } from '../../src/components/ui/Modal.jsx';
import { Drawer } from '../../src/components/ui/Drawer.jsx';
import { OtpInput } from '../../src/components/ui/OtpInput.jsx';
import { Pagination } from '../../src/components/ui/Pagination.jsx';
import { PasswordInput } from '../../src/components/ui/PasswordInput.jsx';
import { FlashMessage } from '../../src/components/ui/FlashMessage.jsx';
import { Switch } from '../../src/components/ui/Switch.jsx';

/** The shared building blocks every screen relies on (web-design.md: a11y is part of "done"). */
describe('Modal and Drawer', () => {
  it('Modal: Escape closes it, and it is a labelled dialog', async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Archive this product?">Body</Modal>);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Archive this product?')).toBeTruthy();
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('Modal: closed renders nothing', () => {
    render(<Modal open={false} onClose={() => {}} title="Hidden">Body</Modal>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Drawer: Escape closes it', async () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose} title="Details">Body</Drawer>);
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('OtpInput', () => {
  function Harness({ onComplete }) {
    const [v, setV] = useState('');
    return <OtpInput label="Code" value={v} onChange={setV} onComplete={onComplete} />;
  }

  it('six boxes; typing fills them in order and completes', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<Harness onComplete={onComplete} />);
    const boxes = screen.getAllByLabelText(/^Digit \d$/);
    expect(boxes).toHaveLength(6);
    await user.click(boxes[0]);
    await user.keyboard('123456');
    expect(boxes.map((b) => b.value).join('')).toBe('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('pasting a code WITH separators ("65 43-21") still fills all six boxes', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<Harness onComplete={onComplete} />);
    const boxes = screen.getAllByLabelText(/^Digit \d$/);
    await user.click(boxes[0]);
    await user.paste('65 43-21');
    expect(boxes.map((b) => b.value).join('')).toBe('654321');
    expect(onComplete).toHaveBeenCalledWith('654321');
  });

  it('letters are ignored', async () => {
    const user = userEvent.setup();
    render(<Harness onComplete={() => {}} />);
    const boxes = screen.getAllByLabelText(/^Digit \d$/);
    await user.click(boxes[0]);
    await user.keyboard('ab');
    expect(boxes.map((b) => b.value).join('')).toBe('');
  });
});

describe('Pagination', () => {
  it('moves between pages and disables what cannot be reached', async () => {
    const onPage = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={1} pageSize={20} total={45} onPage={onPage} />);
    expect(screen.getByRole('button', { name: 'Previous page' }).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPage).toHaveBeenCalledWith(2);
    await user.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(onPage).toHaveBeenCalledWith(3);
  });
});

describe('PasswordInput', () => {
  it('is masked until "Show password"', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" value="secret123" onChange={() => {}} />);
    const input = screen.getByLabelText('Password');
    expect(input.getAttribute('type')).toBe('password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input.getAttribute('type')).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy();
  });
});

describe('FlashMessage (confirmations disappear)', () => {
  it('hides itself after 6 s, or at once with its ✕', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<FlashMessage onDismiss={onDismiss}>Saved.</FlashMessage>);
    expect(screen.getByText('Saved.')).toBeTruthy();
    act(() => vi.advanceTimersByTime(5900));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('a warning stays for 10 s', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<FlashMessage tone="warning" onDismiss={onDismiss}>Heads up.</FlashMessage>);
    act(() => vi.advanceTimersByTime(9000));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1100));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('Switch', () => {
  it('is a labelled switch that reports its state', async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Switch on Cotton" />);
    const sw = screen.getByRole('switch', { name: 'Switch on Cotton' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    await userEvent.setup().click(sw);
    expect(onChange).toHaveBeenCalled();
  });
});
