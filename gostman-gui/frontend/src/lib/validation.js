const UNICODE_NAME = /^[\p{L}_][\p{L}\p{N}_-]*$/u
const PLAIN_NAME = /^[A-Za-z_ª-￿][\wª-￿-]*$/
const VARIABLE_NAME = UNICODE_NAME.test('a') ? UNICODE_NAME : PLAIN_NAME

export const isVariableName = (name) => VARIABLE_NAME.test(name)
