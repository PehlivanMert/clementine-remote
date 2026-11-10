import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SleepTimerModal } from '../components/SleepTimerModal';
import { api } from '../api';
import { SleepTimerStatus } from '../types';

vi.mock('../api', () => ({
  api: {
    startSleepTimer: vi.fn(),
    cancelSleepTimer: vi.fn(),
  },
}));

describe('SleepTimerModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders quick duration presets when timer is inactive', () => {
    const timerStatus: SleepTimerStatus = {
      active: false,
      remaining_seconds: 0,
      initial_volume: 88,
      is_fading: false,
    };

    render(
      <SleepTimerModal
        isOpen={true}
        onClose={vi.fn()}
        timerStatus={timerStatus}
        onTimerUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('15 dk')).toBeInTheDocument();
    expect(screen.getByText('30 dk')).toBeInTheDocument();
    expect(screen.getByText('45 dk')).toBeInTheDocument();
    expect(screen.getByText('60 dk')).toBeInTheDocument();
    expect(screen.getByText(/Parça Sonu/i)).toBeInTheDocument();
  });

  it('starts timer with selected preset duration', async () => {
    const updatedStatus: SleepTimerStatus = {
      active: true,
      remaining_seconds: 1800,
      initial_volume: 88,
      is_fading: false,
    };
    vi.mocked(api.startSleepTimer).mockResolvedValueOnce(updatedStatus);
    const onTimerUpdate = vi.fn();

    render(
      <SleepTimerModal
        isOpen={true}
        onClose={vi.fn()}
        timerStatus={{ active: false, remaining_seconds: 0, initial_volume: 88, is_fading: false }}
        onTimerUpdate={onTimerUpdate}
      />
    );

    fireEvent.click(screen.getByText('30 dk'));

    await waitFor(() => {
      expect(api.startSleepTimer).toHaveBeenCalledWith({ duration_minutes: 30 });
      expect(onTimerUpdate).toHaveBeenCalledWith(updatedStatus);
    });
  });

  it('displays countdown and cancels active timer', async () => {
    const activeStatus: SleepTimerStatus = {
      active: true,
      remaining_seconds: 590, // ~ 09:50
      initial_volume: 88,
      is_fading: false,
    };
    const cancelledStatus: SleepTimerStatus = {
      active: false,
      remaining_seconds: 0,
      initial_volume: 88,
      is_fading: false,
    };
    vi.mocked(api.cancelSleepTimer).mockResolvedValueOnce(cancelledStatus);
    const onTimerUpdate = vi.fn();

    render(
      <SleepTimerModal
        isOpen={true}
        onClose={vi.fn()}
        timerStatus={activeStatus}
        onTimerUpdate={onTimerUpdate}
      />
    );

    expect(screen.getByText('09:50')).toBeInTheDocument();
    const cancelBtn = screen.getByText(/Zamanlayıcıyı İptal Et/i);
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(api.cancelSleepTimer).toHaveBeenCalledTimes(1);
      expect(onTimerUpdate).toHaveBeenCalledWith(cancelledStatus);
    });
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <SleepTimerModal
        isOpen={true}
        onClose={onClose}
        timerStatus={{ active: false, remaining_seconds: 0, initial_volume: 88, is_fading: false }}
        onTimerUpdate={vi.fn()}
      />
    );

    const closeBtn = screen.getByTitle('Kapat');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
