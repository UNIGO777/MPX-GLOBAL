import { z } from 'zod';

import { zString } from './helpers.js';
import { DEVICE_PLATFORM } from '../models/enums.js';

// M4-H — FCM tokens are long opaque strings. Bounded so a hostile client cannot
// push an unbounded blob into an indexed, unique field.
const fcmToken = zString({ min: 20, max: 4096 });

export const registerDevice = {
  body: z.object({
    token: fcmToken,
    platform: z.enum(DEVICE_PLATFORM),
  }),
};

export const deviceTokenParam = {
  params: z.object({ token: fcmToken }),
};
