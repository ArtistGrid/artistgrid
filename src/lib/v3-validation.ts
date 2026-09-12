import Ajv from "ajv";
import v3Schema from "../.ts-runtime-validation/validation.schema.json";
import type { V3Response } from "../v3.jsonschema";
const ajv = new Ajv({ allErrors: true, strict: false });
const validateV3 = ajv.compile(v3Schema);
export function isValidV3Response(payload: unknown): payload is V3Response {
  return validateV3(payload) === true;
}
