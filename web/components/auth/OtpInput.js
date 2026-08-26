'use client';

import { useRef } from 'react';

/**
 * Six-box OTP entry with auto-advance and backspace-to-previous.
 * Used by both login verification and the separate handover OTP (§13).
 */
export default function OtpInput({ length = 6, value, onChange, numericOnly = true }) {
  const refs = useRef([]);

  const setDigit = (index, digit) => {
    const next = value.split('');
    next[index] = digit;
    onChange(next.join('').slice(0, length));
  };

  const handleInput = (index) => (e) => {
    const raw = numericOnly ? e.target.value.replace(/\D/g, '') : e.target.value;
    const digit = raw.slice(-1);
    setDigit(index, digit);
    if (digit && refs.current[index + 1]) refs.current[index + 1].focus();
  };

  const handleKeyDown = (index) => (e) => {
    if (e.key === 'Backspace' && !value[index] && refs.current[index - 1]) {
      refs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text');
    const digits = (numericOnly ? pasted.replace(/\D/g, '') : pasted).slice(0, length);
    if (!digits) return;
    e.preventDefault();
    onChange(digits);
    refs.current[Math.min(digits.length, length - 1)]?.focus();
  };

  return (
    <div className="otp-row">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          maxLength={1}
          inputMode={numericOnly ? 'numeric' : 'text'}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={value[i] || ''}
          onChange={handleInput(i)}
          onKeyDown={handleKeyDown(i)}
          onPaste={handlePaste}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
