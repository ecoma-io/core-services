import { expandEnv } from './expand-env';

describe('expandEnv', () => {
  it('replaces simple ${VAR} references', () => {
    // Arrange
    const input = { A: '1', B: '${A}' };
    // Act
    const out = expandEnv(input);
    // Assert
    expect(out['A']).toBe('1');
    expect(out['B']).toBe('1');
  });

  it('supports default syntax ${VAR:-default}', () => {
    // Arrange
    const input = { A: '${MISSING:-def}', B: 'x${MISSING:-y}z' };
    // Act
    const out = expandEnv(input);
    // Assert
    expect(out['A']).toBe('def');
    expect(out['B']).toBe('xyz');
  });

  it('resolves cross-key references across multiple passes', () => {
    // Arrange
    const input = { A: '${B}', B: '${C}', C: 'final' };
    // Act
    const out = expandEnv(input);
    // Assert
    expect(out['C']).toBe('final');
    expect(out['B']).toBe('final');
    expect(out['A']).toBe('final');
  });

  it('supports multiple placeholders in one value', () => {
    // Arrange
    const input = {
      HOST: 'localhost',
      PORT: '3000',
      URL: 'http://${HOST}:${PORT}/api',
    };
    // Act
    const out = expandEnv(input);
    // Assert
    expect(out['URL']).toBe('http://localhost:3000/api');
  });

  it('works for lowercase placeholder like localhost:${ref} when key is uppercase', () => {
    // Arrange
    const input = { REF: '4000', URL: 'localhost:${ref}' };
    // Act
    const out = expandEnv(input);
    // Assert
    expect(out['URL']).toBe('localhost:4000');
  });

  it('works when placeholder itself is lowercase and key matches lowercase', () => {
    // Arrange
    const input = { ref: '5000', URL: 'localhost:${ref}' };
    // Act
    const out = expandEnv(input);
    // Assert
    expect(out['URL']).toBe('localhost:5000');
  });

  it('handles simple circular references without throwing (converges)', () => {
    // Arrange
    const input = { A: '${B}', B: '${A}' };
    // Act
    const out = expandEnv(input);
    // Assert
    // The algorithm converges to self-referential tokens (e.g. "${A}"), ensure function terminates
    expect(typeof out['A']).toBe('string');
    expect(typeof out['B']).toBe('string');
    // after convergence the two keys should be equal and remain a self-referential token
    expect(out['A']).toBe(out['B']);
    expect(String(out['A'])).toMatch(/^\$\{[A-Za-z0-9_:-]+\}$/);
  });
});
