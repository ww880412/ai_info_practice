import { describe, it, expect, beforeEach } from 'vitest';
import { ReActAgent } from '../engine';
import { getDefaultConfig } from '../config';
import type { ParseResult } from '../../../parser';

describe('ReActAgent mode switching', () => {
  let agent: ReActAgent;

  beforeEach(() => {
    const config = getDefaultConfig();
    agent = new ReActAgent(config);
  });

  it('should have processWithMode method', () => {
    expect(agent.processWithMode).toBeDefined();
    expect(typeof agent.processWithMode).toBe('function');
  });

  it('should accept two-step mode parameter', () => {
    const input: ParseResult = {
      title: 'Test',
      content: 'Test content for mode switching',
      sourceType: 'WEBPAGE',
    };

    // Should not throw
    expect(() => {
      agent.processWithMode('test-entry-id', input, 'two-step');
    }).not.toThrow();
  });

  it('should accept tool-calling mode parameter', () => {
    const input: ParseResult = {
      title: 'Test',
      content: 'Test content for mode switching',
      sourceType: 'WEBPAGE',
    };

    // Should not throw
    expect(() => {
      agent.processWithMode('test-entry-id', input, 'tool-calling');
    }).not.toThrow();
  });
});
