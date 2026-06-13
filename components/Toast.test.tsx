import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast } from './Toast';

describe('Toast', () => {
  it('renders message and calls onClose after timeout', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    render(
      <Toast
        toast={{ id: 1, message: 'Đã lưu cài đặt', type: 'success' }}
        durationMs={1000}
        onClose={onClose}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu cài đặt');
    vi.advanceTimersByTime(1000);
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
