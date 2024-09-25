import { PlainMessage } from '@bufbuild/protobuf';
import { HandlerContext } from '@connectrpc/connect';
import { EnumStatusCode } from '@wundergraph/cosmo-connect/dist/common/common_pb';
import {
  CreateOperationIgnoreAllOverrideRequest,
  CreateOperationIgnoreAllOverrideResponse,
} from '@wundergraph/cosmo-connect/dist/platform/v1/platform_pb';
import { AuditLogRepository } from '../../repositories/AuditLogRepository.js';
import { FederatedGraphRepository } from '../../repositories/FederatedGraphRepository.js';
import { OperationsRepository } from '../../repositories/OperationsRepository.js';
import type { RouterOptions } from '../../routes.js';
import { enrichLogger, getLogger, handleError } from '../../util.js';

export function createOperationIgnoreAllOverride(
  opts: RouterOptions,
  req: CreateOperationIgnoreAllOverrideRequest,
  ctx: HandlerContext,
): Promise<PlainMessage<CreateOperationIgnoreAllOverrideResponse>> {
  let logger = getLogger(ctx, opts.logger);

  return handleError<PlainMessage<CreateOperationIgnoreAllOverrideResponse>>(ctx, logger, async () => {
    const authContext = await opts.authenticator.authenticate(ctx.requestHeader);
    logger = enrichLogger(ctx, logger, authContext);

    const fedGraphRepo = new FederatedGraphRepository(logger, opts.db, authContext.organizationId);
    const auditLogRepo = new AuditLogRepository(opts.db);

    if (!authContext.hasWriteAccess) {
      return {
        response: {
          code: EnumStatusCode.ERR,
          details: `The user does not have permissions to perform this operation`,
        },
      };
    }

    const graph = await fedGraphRepo.byName(req.graphName, req.namespace);

    if (!graph) {
      return {
        response: {
          code: EnumStatusCode.ERR_NOT_FOUND,
          details: 'Requested graph does not exist',
        },
      };
    }

    const operationsRepo = new OperationsRepository(opts.db, graph.id);

    const affectedChanges = await operationsRepo.createIgnoreAllOverride({
      namespaceId: graph.namespaceId,
      operationHash: req.operationHash,
      operationName: req.operationName,
      actorId: authContext.userId,
    });

    if (affectedChanges.length === 0) {
      return {
        response: {
          code: EnumStatusCode.ERR,
          details: 'Could not create ignore override for this operation',
        },
      };
    }

    await auditLogRepo.addAuditLog({
      organizationId: authContext.organizationId,
      auditAction: 'operation_ignore_override.created',
      action: 'updated',
      actorId: authContext.userId,
      auditableType: 'operation_ignore_all_override',
      auditableDisplayName: req.operationHash,
      actorDisplayName: authContext.userDisplayName,
      actorType: authContext.auth === 'api_key' ? 'api_key' : 'user',
      targetNamespaceId: graph.namespaceId,
      targetNamespaceDisplayName: graph.namespace,
    });

    return {
      response: {
        code: EnumStatusCode.OK,
      },
    };
  });
}