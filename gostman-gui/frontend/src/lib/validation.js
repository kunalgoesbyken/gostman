const VARIABLE_NAME = /^[\p{L}_][\p{L}\p{N}_-]*$/u

export const isVariableName = (name) => VARIABLE_NAME.test(name)
