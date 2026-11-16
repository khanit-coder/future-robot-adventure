import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { RegistrationView } from '@/features/player/RegistrationView';
import { useAppStore } from '@/stores/appStore';

describe('Registration & bilingual switching', () => {
  beforeEach(() => {
    void i18n.changeLanguage('en');
    useAppStore.setState({
      loaded: true,
      activeSession: {
        id: 's1',
        name: 'College Open House',
        status: 'ACTIVE',
        registration_open: true,
        started_at: '2026-01-01T00:00:00Z',
        closed_at: null,
        created_at: '',
        updated_at: '',
      },
      settings: null,
    });
  });

  it('validates required display name and school name', () => {
    render(<RegistrationView />);
    fireEvent.click(screen.getByTestId('register-submit'));
    expect(screen.getByRole('alert')).toHaveTextContent(/display name/i);

    fireEvent.change(screen.getByLabelText(/Display Name/i), { target: { value: 'Tonkla' } });
    fireEvent.click(screen.getByTestId('register-submit'));
    expect(screen.getByRole('alert')).toHaveTextContent(/school/i);
  });

  it('switches between English and Thai without clearing typed input', () => {
    render(<RegistrationView />);
    const nameInput = screen.getByLabelText(/Display Name/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Tonkla' } });

    fireEvent.click(screen.getByTestId('lang-th'));
    expect(screen.getByText('เข้าสู่การผจญภัย')).toBeInTheDocument();
    expect(nameInput.value).toBe('Tonkla');

    fireEvent.click(screen.getByTestId('lang-en'));
    expect(screen.getByText('Join Adventure')).toBeInTheDocument();
    expect(nameInput.value).toBe('Tonkla');
  });
});
