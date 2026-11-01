import { Transform } from 'class-transformer';

export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export const ToLowerCase = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export const ToUpperCase = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));

export const TrimOrNull = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value));

// Los parámetros de consulta llegan como texto y deben convertirse antes de validarse
export const ToInt = () =>
  Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)));

export const ToBoolean = () =>
  Transform(({ value }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value));
