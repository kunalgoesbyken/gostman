import { SCHEMA_TEXT } from '../checksText'
import { schemaMismatches } from '../jsonSchema'

export function schemaAssertions({ Assertion }) {
  function matchesSchema(schema) {
    const mismatches = schemaMismatches(schema, this._obj)
    this.assert(mismatches.length === 0, SCHEMA_TEXT.mismatch(mismatches), SCHEMA_TEXT.unexpectedMatch)
  }
  Assertion.addMethod('jsonSchema', matchesSchema)
  Assertion.addMethod('matchSchema', matchesSchema)
}
