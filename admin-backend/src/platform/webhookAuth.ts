import crypto from 'crypto';
import { timingSafeEqualString } from '../utils/timingSafe.js';

export const verifySepayApiKey = (authorization: string, apiKey: string): boolean => {
  const expectedBearer = `Bearer ${apiKey}`;
  const expectedApikey = `Apikey ${apiKey}`;
  return timingSafeEqualString(authorization, expectedBearer)
    || timingSafeEqualString(authorization, expectedApikey);
};

export const verifyHmacSignature = (
  payload: Buffer,
  signature: string,
  secret: string
): boolean => {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const provided = signature.replace(/^sha256=/i, '');
  return timingSafeEqualString(expected, provided);
};

export const verifyLegacySepaySignature = (
  body: string,
  signature: string,
  secret: string
): boolean => {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return timingSafeEqualString(signature, expected);
};
