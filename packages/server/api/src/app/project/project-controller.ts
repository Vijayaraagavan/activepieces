// --- MY_CUSTOM_START: Headless multi-project controller (replaces original community controller) ---
import { ApId, CreatePlatformProjectRequest, PrincipalType, Project, ProjectType, SeekPage, SERVICE_KEY_SECURITY_OPENAPI, UpdateProjectRequestInCommunity } from '@activepieces/shared'
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { StatusCodes } from 'http-status-codes'
import { IsNull } from 'typeorm'
import { z } from 'zod'
import { ProjectResourceType } from '../core/security/authorization/common'
import { securityAccess } from '../core/security/authorization/fastify-security'
import { isInternalRequest } from '../core/security/v2/authn/authentication-middleware'
import { paginationHelper } from '../helper/pagination/pagination-utils'
import { projectRepo, projectService } from './project-service'

export const projectController: FastifyPluginAsyncZod = async (fastify) => {

    fastify.post('/', CreateProjectRequest, async (request, reply) => {
        const platformId = request.principal.platform.id
        const project = await projectService(request.log).create({
            ownerId: request.principal.id,
            displayName: request.body.displayName,
            platformId,
            type: ProjectType.TEAM,
            externalId: request.body.externalId ?? undefined,
            metadata: request.body.metadata ?? undefined,
            maxConcurrentJobs: request.body.maxConcurrentJobs ?? undefined,
        })
        return reply.status(StatusCodes.CREATED).send(project)
    })

    fastify.post('/:id', UpdateProjectRequest, async (request) => {
        const project = await projectService(request.log).getOneOrThrow(request.params.id)
        return projectService(request.log).update(request.params.id, {
            type: project.type,
            ...request.body,
        })
    })

    fastify.get('/:id', GetProjectRequest, async (request) => {
        return projectService(request.log).getOneOrThrow(request.projectId)
    })

    fastify.get('/', ListProjectsRequest, async (request) => {
        if (isInternalRequest(request)) {
            const projects = await projectRepo().find({
                where: { platformId: request.principal.platform.id, deleted: IsNull() },
                order: { type: 'ASC', displayName: 'ASC' },
            })
            return paginationHelper.createPage(projects, null)
        }
        return paginationHelper.createPage([await projectService(request.log).getUserProjectOrThrow(request.principal.id)], null)
    })

    fastify.delete('/:id', DeleteProjectRequest, async (request, reply) => {
        await projectRepo().update(
            { id: request.params.id, platformId: request.principal.platform.id },
            { deleted: new Date().toISOString() },
        )
        return reply.status(StatusCodes.NO_CONTENT).send()
    })
}

const CreateProjectRequest = {
    config: {
        security: securityAccess.publicPlatform([PrincipalType.USER]),
    },
    schema: {
        tags: ['projects'],
        body: CreatePlatformProjectRequest,
        response: {
            [StatusCodes.CREATED]: Project,
        },
    },
}

const UpdateProjectRequest = {
    config: {
        security: securityAccess.publicPlatform([PrincipalType.USER, PrincipalType.SERVICE]),
    },
    schema: {
        tags: ['projects'],
        params: z.object({
            id: z.string(),
        }),
        response: {
            [StatusCodes.OK]: Project,
        },
        body: UpdateProjectRequestInCommunity,
    },
}

const GetProjectRequest = {
    config: {
        security: securityAccess.project([PrincipalType.USER], undefined, {
            type: ProjectResourceType.PARAM,
            paramKey: 'id',
        }),
    },
    schema: {
        tags: ['projects'],
        params: z.object({
            id: ApId,
        }),
        response: {
            [StatusCodes.OK]: Project,
        },
    },
}

const ListProjectsRequest = {
    config: {
        security: securityAccess.publicPlatform([PrincipalType.USER]),
    },
    schema: {
        tags: ['projects'],
        response: {
            [StatusCodes.OK]: SeekPage(Project),
        },
        security: [SERVICE_KEY_SECURITY_OPENAPI],
    },
}

const DeleteProjectRequest = {
    config: {
        security: securityAccess.publicPlatform([PrincipalType.USER]),
    },
    schema: {
        tags: ['projects'],
        params: z.object({
            id: ApId,
        }),
    },
}
// --- MY_CUSTOM_END ---   