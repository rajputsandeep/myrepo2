// routes/licenseRequests.ts
import express from "express";
import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../dataSource/data-source";
import { LicenseUpdateRequest, RequestStatus, RequestType, ResourceType } from "../entities/LicenseUpdateRequest";
import { LicenseUpdateApproval, ApprovalStage, Decision } from "../entities/LicenseUpdateApproval";
import { LicenseApprovalLevel } from "../entities/LicenseApprovalLevel";
import { LicenseAllocation } from "../entities/LicenseAllocation";
import { User } from "../entities/User";
import { audit } from "../helpers/audit";
import { createError } from "../middleware/errorHandler";

const router = express.Router();

/**
 * Create a new license update request (initiated by sales user)
 * Body: { clientId, clientName, resourceType, requestType, currentCount, changeCount, reason }
 */
router.post("/license-requests", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body || {};
    const {
      clientId,
      clientName,
      resourceType,
      requestType,
      currentCount,
      changeCount,
      reason,
    } = body;

    // basic validation
    if (!clientId || !resourceType || !requestType || currentCount == null || changeCount == null || !reason) {
      throw createError(400, "Missing required fields");
    }

    const userId = (req.user as any)?.sub || null;

    const result = await AppDataSource.manager.transaction(async (manager) => {
      // create request
      const reqRepo = manager.getRepository(LicenseUpdateRequest);
      const newReq = reqRepo.create({
        clientId,
        clientName: clientName || null,
        resourceType,
        requestType,
        currentCount: Number(currentCount),
        changeCount: Number(changeCount),
        newTotal: requestType === RequestType.INCREASE ? Number(currentCount) + Number(changeCount) : Number(currentCount) - Number(changeCount),
        reason,
        salesContactId: userId || null,
        status: RequestStatus.PENDING,
      } as any);

      const savedReq = await reqRepo.save(newReq);

      // build approval rows based on LicenseApprovalLevel
      const levels = await manager.getRepository(LicenseApprovalLevel)
        .createQueryBuilder("lvl")
        .where("lvl.client_id = :cid", { cid: clientId })
        .orderBy("lvl.step_order", "ASC")
        .getMany();

      const finalLevels = levels.length > 0 ? levels : [{ stepOrder: 1, departmentName: "CEO", approvalStage: "ceo" } as any];

      const approvalRepo = manager.getRepository(LicenseUpdateApproval);
      for (const lvl of finalLevels) {
        const approvalRow = approvalRepo.create({
          request: savedReq,
          requestId: savedReq.id,
          approvalStage: lvl.approvalStage || lvl.departmentName,
          decision: Decision.PENDING,
          status: RequestStatus.PENDING,
        } as any);
        await approvalRepo.save(approvalRow);
      }

      // audit
      await audit({
        req,
        clientId,
        action: "LICENSE_REQUEST_CREATED",
        resource: "LicenseUpdateRequest",
        meta: { requestId: savedReq.id, createdBy: userId, currentCount, changeCount, requestType },
      });

      return savedReq;
    });

    return res.status(201).json({ success: true, requestId: result.id });
  } catch (err) {
    next(err);
  }
});

/**
 * Get request detail
 */
router.get("/license-requests/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const request = await AppDataSource.manager.getRepository(LicenseUpdateRequest).findOne({
      where: { id } as any,
      relations: ["approvals", "auditLogs"],
    });
    if (!request) throw createError(404, "Request not found");
    return res.json({ success: true, request });
  } catch (err) {
    next(err);
  }
});

/**
 * List requests (simple)
 * Query: clientId, status, page, limit
 */
router.get("/license-requests", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = req.query.clientId as string | undefined;
    const status = req.query.status as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 25);
    const qb = AppDataSource.manager.getRepository(LicenseUpdateRequest).createQueryBuilder("r").orderBy("r.created_at", "DESC");
    if (clientId) qb.andWhere("r.client_id = :cid", { cid: clientId });
    if (status) qb.andWhere("r.status = :status", { status });
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return res.json({ success: true, page, limit, total, items });
  } catch (err) {
    next(err);
  }
});

/**
 * Approve / Reject endpoint
 * POST /license-requests/:id/decide
 * Body: { decision: "approved" | "rejected", comments?: string }
 * The currently pending approval row will be decided by the caller if they belong to the department allowed for this step.
 */
router.post("/license-requests/:id/decide", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { decision, comments } = req.body;
    if (!decision || !["approved", "rejected"].includes(String(decision).toLowerCase())) {
      throw createError(400, "Invalid decision");
    }
    const callerId = (req.user as any)?.sub;
    if (!callerId) throw createError(403, "Unauthenticated");

    const result = await AppDataSource.manager.transaction(async (manager) => {
      const reqRepo = manager.getRepository(LicenseUpdateRequest);
      const approvalRepo = manager.getRepository(LicenseUpdateApproval);
      const request = await reqRepo.findOne({ where: { id } as any, relations: ["approvals"] });
      if (!request) throw createError(404, "Request not found");
      if (request.status !== RequestStatus.PENDING) throw createError(400, `Request already ${request.status}`);

      // find current pending approval (lowest step-order row still pending)
      const pendingApproval = await approvalRepo.createQueryBuilder("a")
        .leftJoin("a.request", "r")
        .where("a.request_id = :rid", { rid: id })
        .andWhere("a.decision = :p", { p: Decision.PENDING })
        .orderBy("a.created_at", "ASC")
        .getOne();

      if (!pendingApproval) throw createError(400, "No pending approval found");

      // Authorization: ensure caller is allowed to approve for this stage.
      // Strategy: check caller's department (DepartmentUser) matches pendingApproval.approvalStage.
      // You should implement `isUserInDepartment(callerId, stage)` to match your department model.
      const stage = (pendingApproval as any).approvalStage;
      // simple check function (you must implement according to your DepartmentUser model):
      async function isUserInStage(userId: string, stageName: string) {
        // If you store stage as department name:
        const row = await manager.query(
          `SELECT 1 FROM department_users du
           JOIN department_roles dr ON dr.department_id = du.department_id
           WHERE du.id = $1 AND LOWER(dr.name) = LOWER($2) LIMIT 1`,
          [userId, stageName]
        );
        return row && row.length > 0;
      }

      const allowed = await isUserInStage(callerId, stage);
      if (!allowed) {
        throw createError(403, "Caller not authorized to approve this stage");
      }

      // record approval
      pendingApproval.approvedById = callerId;
      pendingApproval.approvedBy = ({ id: callerId } as any); // minimal relation if needed
      pendingApproval.decision = decision === "approved" ? Decision.APPROVED : Decision.REJECTED;
      pendingApproval.status = (decision === "approved") ? RequestStatus.APPROVED : RequestStatus.REJECTED;
      pendingApproval.comments = comments || null;
      pendingApproval.decidedAt = new Date();

      await approvalRepo.save(pendingApproval);

      // audit for approval decision
      await audit({
        req,
        clientId: request.clientId,
        action: decision === "approved" ? "LICENSE_APPROVAL_APPROVED" : "LICENSE_APPROVAL_REJECTED",
        resource: "LicenseUpdateApproval",
        meta: { requestId: request.id, approvalId: pendingApproval.id, by: callerId, decision, comments },
      });

      if (decision === "rejected") {
        // mark whole request rejected and set rejection reason
        request.status = RequestStatus.REJECTED;
        request.rejectionReason = comments || "Rejected by approver";
        await reqRepo.save(request);

        // audit request rejection
        await audit({
          req,
          clientId: request.clientId,
          action: "LICENSE_REQUEST_REJECTED",
          resource: "LicenseUpdateRequest",
          meta: { requestId: request.id, by: callerId, comments },
        });

        return { status: "rejected" };
      }

      // decision === approved => check if more approvals pending
      const nextPending = await approvalRepo.createQueryBuilder("a")
        .where("a.request_id = :rid", { rid: id })
        .andWhere("a.decision = :p", { p: Decision.PENDING })
        .orderBy("a.created_at", "ASC")
        .getOne();

      if (nextPending) {
        // still pending approvals — update request (keep PENDING)
        // Optionally notify next approver(s)
        return { status: "pending", nextApprovalId: nextPending.id, nextStage: nextPending.approvalStage };
      } else {
        // final approval reached -> mark request APPROVED and apply to LicenseAllocation
        request.status = RequestStatus.APPROVED;
        await reqRepo.save(request);

        // update LicenseAllocation for the client and license type
        // NOTE: you must identify which LicenseTypeMaster to update; I'm using a simple example where resourceType==LICENSE and licenseType is in meta or request
        if (request.resourceType === ResourceType.LICENSE) {
          // Example: find LicenceAllocation row for this client and licenseType. If your request references licenseTypeId, use it.
          // For demo: update first allocation for client (adjust per your domain).
          const alloc = await manager.getRepository(LicenseAllocation).createQueryBuilder("la")
            .leftJoin("la.Client", "c")
            .where("c.id = :cid", { cid: request.clientId })
            .getOne();

          if (alloc) {
            const delta = request.changeCount;
            if (request.requestType === RequestType.INCREASE) {
              alloc.allocatedCount = Number(alloc.allocatedCount || 0) + Number(delta);
            } else {
              alloc.allocatedCount = Math.max(0, Number(alloc.allocatedCount || 0) - Number(delta));
            }
            await manager.getRepository(LicenseAllocation).save(alloc);

            // audit allocation update
            await audit({
              req,
              clientId: request.clientId,
              action: "LICENSE_ALLOCATION_UPDATED",
              resource: "LicenseAllocation",
              meta: { allocationId: alloc.id, change: request.changeCount, newAllocatedCount: alloc.allocatedCount, requestId: request.id },
            });
          } else {
            // optionally create allocation row if not found or log warning
            console.warn("No LicenseAllocation found for client", request.clientId);
          }
        }

        // audit request final approval
        await audit({
          req,
          clientId: request.clientId,
          action: "LICENSE_REQUEST_APPROVED",
          resource: "LicenseUpdateRequest",
          meta: { requestId: request.id },
        });

        return { status: "approved" };
      }
    });

    return res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

/**
 * Cancel a request
 * POST /license-requests/:id/cancel
 * Only requester or superadmin can cancel
 */
router.post("/license-requests/:id/cancel", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const callerId = (req.user as any)?.sub;
    const isSuper = (req.user as any)?.typ === "superadmin";

    const result = await AppDataSource.manager.transaction(async (manager) => {
      const reqRepo = manager.getRepository(LicenseUpdateRequest);
      const approvalRepo = manager.getRepository(LicenseUpdateApproval);
      const request = await reqRepo.findOne({ where: { id } as any });
      if (!request) throw createError(404, "Request not found");
      if (![RequestStatus.PENDING].includes(request.status)) throw createError(400, `Cannot cancel request in status ${request.status}`);

      // allow only requester or superadmin
      if (!isSuper && callerId !== request.salesContactId) throw createError(403, "Not allowed to cancel");

      request.status = RequestStatus.CANCELLED;
      await reqRepo.save(request);

      // mark all pending approvals as cancelled
      await approvalRepo.createQueryBuilder()
        .update()
        .set({ decision: Decision.PENDING, status: RequestStatus.CANCELLED, comments: "Cancelled by requester" })
        .where("request_id = :rid AND decision = :p", { rid: id, p: Decision.PENDING })
        .execute();

      // audit
      await audit({
        req,
        clientId: request.clientId,
        action: "LICENSE_REQUEST_CANCELLED",
        resource: "LicenseUpdateRequest",
        meta: { requestId: request.id, by: callerId },
      });

      return { cancelled: true };
    });

    return res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

export default router;
