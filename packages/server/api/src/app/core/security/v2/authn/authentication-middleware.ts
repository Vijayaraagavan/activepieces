import { isNil, PrincipalType } from '@activepieces/shared'
import { FastifyRequest } from 'fastify'
// --- MY_CUSTOM_START: Headless internal multi-platform auth imports ---
import { system } from '../../../../helper/system/system'
import { AppSystemProp } from '../../../../helper/system/system-props'
import { platformService } from '../../../../platform/platform.service'
// --- MY_CUSTOM_END ---
import { RouteKind } from '../../authorization/common'
import { authenticateOrThrow } from './authenticate'

// --- MY_CUSTOM_START: Headless internal multi-platform auth ---
const INTERNAL_API_KEY = system.get(AppSystemProp.INTERNAL_API_KEY)
const platformOwnerCache = new Map<string, string>()

function getInternalPlatformId(request: FastifyRequest): string {
    const raw = request.headers['x-internal-platform-id']
    if (Array.isArray(raw)) {
        throw new Error('x-internal-platform-id must be a single value')
    }
    if (isNil(raw) || raw.trim() === '') {
        throw new Error('x-internal-platform-id is required for internal requests')
    }
    return raw
}

async function resolveOwnerId(log: Parameters<typeof platformService>[0], platformId: string): Promise<string> {
    const cachedOwnerId = platformOwnerCache.get(platformId)
    if (cachedOwnerId) return cachedOwnerId
    const platform = await platformService(log).getOneOrThrow(platformId)
    platformOwnerCache.set(platformId, platform.ownerId)
    return platform.ownerId
}

export function isInternalRequest(request: FastifyRequest): boolean {
    if (isNil(INTERNAL_API_KEY)) return false
    return request.headers['x-internal-api-key'] === INTERNAL_API_KEY
}
// --- MY_CUSTOM_END ---

export const authenticationMiddleware = async (request: FastifyRequest): Promise<void> => {
    // --- MY_CUSTOM_START: Headless internal multi-platform auth ---
    if (isInternalRequest(request)) {
        const platformId = getInternalPlatformId(request)
        const ownerId = await resolveOwnerId(request.log, platformId)
        request.principal = {
            id: ownerId,
            type: PrincipalType.USER,
            platform: { id: platformId },
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
