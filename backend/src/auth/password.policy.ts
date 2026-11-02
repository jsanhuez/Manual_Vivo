export const BCRYPT_COST = 10;

// bcrypt solo considera los primeros 72 bytes, por eso se limita el largo máximo
export const PASSWORD_RULE = /^(?=.*[A-ZÁÉÍÓÚÑ])(?=.*\d)(?=.*[^A-Za-zÁÉÍÓÚÑáéíóúñ\d\s]).{10,72}$/;

export const PASSWORD_MESSAGE =
  'La contraseña debe tener entre 10 y 72 caracteres, con al menos una mayúscula, un número y un símbolo';
