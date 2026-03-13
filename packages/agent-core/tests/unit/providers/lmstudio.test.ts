import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  testLMStudioConnection,
  fetchLMStudioModels,
  validateLMStudioConfig,
} from '../../../src/providers/lmstudio.js';

vi.mock('../../../src/providers/tool-support-testing.js', () => ({
  testLMStudioModelToolSupport: vi.fn(),
}));

import { testLMStudioModelToolSupport } from '../../../src/providers/tool-support-testing.js';

const mockedToolSupport = vi.mocked(testLMStudioModelToolSupport);

describe('testLMStudioConnection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockedToolSupport.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return error for invalid URL', async () => {
    const result = await testLMStudioConnection({ url: 'not-a-url' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error for non-http URL', async () => {
    const result = await testLMStudioConnection({ url: 'ftp://localhost:1234' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('http');
  });

  it('should return error when no models are loaded', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    const result = await testLMStudioConnection({ url: 'http://localhost:1234' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('No models');
  });

  it('should return models with tool support when successful', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'llama-3.1-8b-instruct', object: 'model' },
          { id: 'mistral-7b', object: 'model' },
        ],
      }),
    } as Response);

    mockedToolSupport.mockResolvedValueOnce('supported').mockResolvedValueOnce('unsupported');

    const result = await testLMStudioConnection({ url: 'http://localhost:1234' });

    expect(result.success).toBe(true);
    expect(result.models).toHaveLength(2);
    expect(result.models![0]).toMatchObject({
      id: 'llama-3.1-8b-instruct',
      toolSupport: 'supported',
    });
    expect(result.models![1]).toMatchObject({ id: 'mistral-7b', toolSupport: 'unsupported' });
  });

  it('should format model display names', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'llama-3-8b', object: 'model' }],
      }),
    } as Response);

    mockedToolSupport.mockResolvedValueOnce('unknown');

    const result = await testLMStudioConnection({ url: 'http://localhost:1234' });

    expect(result.success).toBe(true);
    // Hyphens replaced with spaces, first letter of each word capitalised
    expect(result.models![0]!.name).toBe('Llama 3 8b');
  });

  it('should return error when server returns non-ok status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);

    const result = await testLMStudioConnection({ url: 'http://localhost:1234' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return timeout error when connection times out', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    vi.mocked(fetch).mockRejectedValueOnce(abortError);

    const result = await testLMStudioConnection({ url: 'http://localhost:1234' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  });

  it('should strip trailing slash from URL before building endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'model-a', object: 'model' }],
      }),
    } as Response);

    mockedToolSupport.mockResolvedValueOnce('unknown');

    await testLMStudioConnection({ url: 'http://localhost:1234/' });

    const calledUrl = vi.mocked(fetch).mock.calls[0]![0] as string;
    expect(calledUrl).toBe('http://localhost:1234/v1/models');
  });
});

describe('fetchLMStudioModels', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockedToolSupport.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return error for invalid URL', async () => {
    const result = await fetchLMStudioModels({ baseUrl: 'not-a-url' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error for non-http URL', async () => {
    const result = await fetchLMStudioModels({ baseUrl: 'ftp://localhost:1234' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('http');
  });

  it('should return models when successful', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'qwen-7b', object: 'model' }],
      }),
    } as Response);

    mockedToolSupport.mockResolvedValueOnce('supported');

    const result = await fetchLMStudioModels({ baseUrl: 'http://localhost:1234' });

    expect(result.success).toBe(true);
    expect(result.models).toHaveLength(1);
    expect(result.models![0]!.id).toBe('qwen-7b');
  });

  it('should return timeout error when connection times out', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    vi.mocked(fetch).mockRejectedValueOnce(abortError);

    const result = await fetchLMStudioModels({ baseUrl: 'http://localhost:1234' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  });
});

describe('validateLMStudioConfig', () => {
  it('should not throw for a valid config', () => {
    expect(() =>
      validateLMStudioConfig({ baseUrl: 'http://localhost:1234', enabled: true }),
    ).not.toThrow();
  });

  it('should throw for an invalid URL', () => {
    expect(() => validateLMStudioConfig({ baseUrl: 'not-a-url', enabled: true })).toThrow();
  });

  it('should throw for a non-http URL', () => {
    expect(() =>
      validateLMStudioConfig({ baseUrl: 'ftp://localhost:1234', enabled: true }),
    ).toThrow();
  });

  it('should throw when baseUrl is missing', () => {
    expect(() =>
      // @ts-expect-error intentionally passing invalid config
      validateLMStudioConfig({ enabled: true }),
    ).toThrow();
  });

  it('should throw when models contain invalid entries', () => {
    expect(() =>
      validateLMStudioConfig({
        baseUrl: 'http://localhost:1234',
        enabled: true,
        // @ts-expect-error intentionally passing invalid model format
        models: [{ id: 123, name: 'bad' }],
      }),
    ).toThrow();
  });

  it('should not throw when models is undefined', () => {
    expect(() =>
      validateLMStudioConfig({ baseUrl: 'http://localhost:1234', enabled: false }),
    ).not.toThrow();
  });
});
