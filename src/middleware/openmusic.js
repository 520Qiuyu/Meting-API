import { apiTokenMiddleware } from './auth.js'

export { verifyMetingAssertion } from './openmusicAssertion.js'

export const openmusicMiddleware = apiTokenMiddleware
