// Misma regla que valida la API en src/auth/password.policy.ts
export const PASSWORD_RULE = /^(?=.*[A-ZÁÉÍÓÚÑ])(?=.*\d)(?=.*[^A-Za-zÁÉÍÓÚÑáéíóúñ\d\s]).{10,72}$/;

export const PASSWORD_HELP = 'Mínimo 10 caracteres, con una mayúscula, un número y un símbolo.';

export interface PasswordStrength {
  score: number;
  label: string;
  tone: 'da' | 'wa' | 'ok';
}

export function passwordStrength(password: string): PasswordStrength {
  const checks = [
    password.length >= 10,
    /[A-ZÁÉÍÓÚÑ]/.test(password),
    /\d/.test(password),
    /[^A-Za-zÁÉÍÓÚÑáéíóúñ\d\s]/.test(password),
    password.length >= 14,
  ];
  const score = checks.filter(Boolean).length;
  if (score <= 2) {
    return { score, label: 'Débil', tone: 'da' };
  }
  if (score <= 3 || !PASSWORD_RULE.test(password)) {
    return { score, label: 'Media', tone: 'wa' };
  }
  return { score, label: score === 5 ? 'Muy segura' : 'Segura', tone: 'ok' };
}
