import { Logger } from '@nestjs/common';
import { MailService } from './mail.service';

jest.spyOn(Logger.prototype, 'log').mockImplementation();
jest.spyOn(Logger.prototype, 'error').mockImplementation();

function serviceWith(values: Record<string, string>): MailService {
  const config = { get: (key: string) => values[key], getOrThrow: (key: string) => values[key] };
  return new MailService(config as never);
}

describe('MailService', () => {
  const base = {
    FRONTEND_URL: 'https://manual-vivo.onrender.com',
    BREVO_API_URL: 'https://api.brevo.com/v3/smtp/email',
    MAIL_FROM_NAME: 'Manual Vivo',
  };
  const recipient = { email: 'ignacia.perez@empresa.test', firstName: 'Ignacia' };
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as never;
  });

  it('sin clave de Brevo deja el correo en el log y no llama a la API', async () => {
    const service = serviceWith(base);
    await expect(service.sendPasswordReset(recipient, 'token')).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envía por la API HTTPS de Brevo con el remitente configurado', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, text: async () => '' });
    const service = serviceWith({ ...base, BREVO_API_KEY: 'clave', MAIL_FROM: 'avisos@empresa.test' });
    await expect(service.sendInvitation(recipient, 'abc', 'Onboarding Operaciones')).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe(base.BREVO_API_URL);
    expect(init.headers['api-key']).toBe('clave');
    expect(body.sender).toEqual({ email: 'avisos@empresa.test', name: 'Manual Vivo' });
    expect(body.to).toEqual([{ email: recipient.email, name: 'Ignacia' }]);
    expect(body.textContent).toContain('https://manual-vivo.onrender.com/activar#abc');
    expect(body.textContent).toContain('Onboarding Operaciones');
  });

  it('informa el fallo cuando Brevo rechaza el envío', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'clave inválida' });
    const service = serviceWith({ ...base, BREVO_API_KEY: 'clave', MAIL_FROM: 'avisos@empresa.test' });
    await expect(service.sendRouteAssigned(recipient, 'Onboarding', '2026-11-30')).resolves.toBe(false);
  });

  it('informa el fallo cuando no hay conexión', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));
    const service = serviceWith({ ...base, BREVO_API_KEY: 'clave', MAIL_FROM: 'avisos@empresa.test' });
    await expect(service.sendReviewRequested(recipient, { procedureId: 1, code: 'A', title: 'B', versionNumber: 2, changeSummary: 'C' })).resolves.toBe(false);
  });

  it('escapa el HTML de los datos ingresados por usuarios', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, text: async () => '' });
    const service = serviceWith({ ...base, BREVO_API_KEY: 'clave', MAIL_FROM: 'avisos@empresa.test' });
    await service.sendVersionPublished(
      { email: recipient.email, firstName: '<b>Ignacia</b>' },
      { procedureId: 4, code: 'OPE-P02-01', title: 'Retiros', versionNumber: 3, changeSummary: '<script>alert(1)</script>' },
    );
    const { htmlContent } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(htmlContent).not.toContain('<script>');
    expect(htmlContent).toContain('&lt;b&gt;Ignacia&lt;/b&gt;');
    expect(htmlContent).toContain('/procedimientos/4');
  });

  it('incluye la observación en el aviso de rechazo', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, text: async () => '' });
    const service = serviceWith({ ...base, BREVO_API_KEY: 'clave', MAIL_FROM: 'avisos@empresa.test' });
    await service.sendVersionRejected(recipient, { procedureId: 4, code: 'A', title: 'B', versionNumber: 2, changeSummary: 'C', reviewNotes: 'Falta un paso' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).textContent).toContain('Falta un paso');
  });
});
