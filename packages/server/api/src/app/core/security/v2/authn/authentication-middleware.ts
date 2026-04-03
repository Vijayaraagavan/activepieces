import { isNil, PrincipalType } from '@activepieces/shared'
import { FastifyRequest } from 'fastify'
// --- MY_CUSTOM_START: Headless internal auth bypass imports ---
import { system } from '../../../../helper/system/system'
import { AppSystemProp } from '../../../../helper/system/system-props'
import { platformService } from '../../../../platform/platform.service'
// --- MY_CUSTOM_END ---
import { RouteKind } from '../../authorization/common'
import { authenticateOrThrow } from './authenticate'

// --- MY_CUSTOM_START: Headless internal auth bypass ---
const INTERNAL_API_KEY = system.get(AppSystemProp.INTERNAL_API_KEY)
const INTERNAL_PLATFORM_ID = system.get(AppSystemProp.INTERNAL_PLATFORM_ID)

let cachedOwnerId: string | null = null

async function resolveOwnerIdOnce(log: Parameters<typeof platformService>[0]): Promise<string> {
    if (cachedOwnerId) return cachedOwnerId
    if (isNil(INTERNAL_PLATFORM_ID)) {
        throw new Error('AP_INTERNAL_PLATFORM_ID must be set when AP_INTERNAL_API_KEY is configured')
    }
    const platform = await platformService(log).getOneOrThrow(INTERNAL_PLATFORM_ID)
    cachedOwnerId = platform.ownerId
    return cachedOwnerId
}

export function isInternalRequest(request: FastifyRequest): boolean {
    if (isNil(INTERNAL_API_KEY)) return false
    return request.headers['x-internal-api-key'] === INTERNAL_API_KEY
}
// --- MY_CUSTOM_END ---

export const authenticationMiddleware = async (request: FastifyRequest): Promise<void> => {
    // --- MY_CUSTOM_START: Headless internal auth bypass ---
    if (isInternalRequest(request)) {
        const ownerId = await resolveOwnerIdOnce(request.log)
        request.principal = {
            id: ownerId,
            type: PrincipalType.USER,
            platform: { id: INTERNAL_PLATFORM_ID! },
            tokenVersion: undefined,
        }
        return
    }
    // --- MY_CUSTOM_END ---

    const security = request.routeOptions.config?.security
    // Todo(@chaker): remove this once we remove v1 authn
    if (isNil(security)) {
        return
    }
    if (security.kind === RouteKind.PUBLIC) {
        return
    }

    const principal = await authenticateOrThrow(request.log, request.headers['authorization'] ?? null)
    request.principal = principal
}

