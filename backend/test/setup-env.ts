// Valores propios de las pruebas, que tienen prioridad sobre .env y nunca se conectan a una base real
Object.assign(process.env, {
  DATABASE_URL: 'postgresql://pruebas:pruebas@localhost:1/pruebas',
  DIRECT_URL: 'postgresql://pruebas:pruebas@localhost:1/pruebas',
  JWT_SECRET: 'clave-de-pruebas-con-mas-de-treinta-y-dos-caracteres',
  FRONTEND_URL: 'http://localhost:5173',
  PORT: '3000',
  THROTTLE_LIMIT: '3000',
  AUTH_THROTTLE_LIMIT: '20',
  BREVO_API_URL: 'https://api.brevo.com/v3/smtp/email',
  BREVO_API_KEY: '',
  MAIL_FROM: '',
  MAIL_FROM_NAME: 'Manual Vivo',
});
