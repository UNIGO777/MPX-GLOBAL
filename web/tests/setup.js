import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount whatever a test rendered, so one screen never leaks into the next.
afterEach(() => cleanup());
