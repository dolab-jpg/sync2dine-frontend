import { describe, expect, it } from 'vitest';
import {
  classifySelfHealError,
  isAuthSelfHealError,
  isOpsSelfHealError,
} from '../../src/app/engine/ai/selfHealEvents';

describe('selfHeal error classification', () => {
  it('treats 502/503/504 as ops', () => {
    expect(classifySelfHealError({ errorCode: 'HTTP_502', description: 'Request failed (502)' })).toBe('ops');
    expect(isOpsSelfHealError({ errorCode: 'HTTP_503', description: 'x', status: 503 })).toBe(true);
    expect(isOpsSelfHealError({ errorCode: 'HTTP_504', description: 'gateway timeout' })).toBe(true);
  });

  it('treats OpenAI quota / billing as ops', () => {
    expect(
      isOpsSelfHealError({
        errorCode: 'HTTP_503',
        description: 'OpenAI key rejected — your OpenAI account has no credit or has hit its usage limit.',
      }),
    ).toBe(true);
  });

  it('treats 401 as auth', () => {
    expect(isAuthSelfHealError({ errorCode: 'HTTP_401', description: 'Unauthorized', status: 401 })).toBe(true);
    expect(classifySelfHealError({ errorCode: 'HTTP_401', description: 'Unauthorized' })).toBe('auth');
  });

  it('treats app 500 / schema as code', () => {
    expect(
      classifySelfHealError({
        errorCode: 'HTTP_500',
        description: 'invalid input syntax for type uuid: "bdiddies"',
      }),
    ).toBe('code');
    expect(
      classifySelfHealError({
        errorCode: 'OPENAI_TOOL_SCHEMA:foo',
        description: "Invalid schema for function 'foo'",
      }),
    ).toBe('code');
  });
});
