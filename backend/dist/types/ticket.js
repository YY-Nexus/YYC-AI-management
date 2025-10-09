"use strict";
/**
 * 工单系统类型定义
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TICKET_STATUS_TRANSITIONS = exports.DEFAULT_SLA_CONFIG = exports.TicketSortField = exports.TicketAction = exports.TicketCategory = exports.TicketPriority = exports.TicketStatus = void 0;
// 枚举类型
var TicketStatus;
(function (TicketStatus) {
    TicketStatus["OPEN"] = "open";
    TicketStatus["IN_PROGRESS"] = "in_progress";
    TicketStatus["PENDING"] = "pending";
    TicketStatus["RESOLVED"] = "resolved";
    TicketStatus["CLOSED"] = "closed";
})(TicketStatus || (exports.TicketStatus = TicketStatus = {}));
var TicketPriority;
(function (TicketPriority) {
    TicketPriority["LOW"] = "low";
    TicketPriority["MEDIUM"] = "medium";
    TicketPriority["HIGH"] = "high";
    TicketPriority["URGENT"] = "urgent";
})(TicketPriority || (exports.TicketPriority = TicketPriority = {}));
var TicketCategory;
(function (TicketCategory) {
    TicketCategory["TECHNICAL"] = "technical";
    TicketCategory["BILLING"] = "billing";
    TicketCategory["GENERAL"] = "general";
    TicketCategory["FEATURE_REQUEST"] = "feature_request";
    TicketCategory["BUG_REPORT"] = "bug_report";
    TicketCategory["ACCOUNT"] = "account";
    TicketCategory["RECONCILIATION"] = "reconciliation";
    TicketCategory["AI_ANALYSIS"] = "ai_analysis";
})(TicketCategory || (exports.TicketCategory = TicketCategory = {}));
var TicketAction;
(function (TicketAction) {
    TicketAction["CREATED"] = "created";
    TicketAction["UPDATED"] = "updated";
    TicketAction["STATUS_CHANGED"] = "status_changed";
    TicketAction["ASSIGNED"] = "assigned";
    TicketAction["UNASSIGNED"] = "unassigned";
    TicketAction["PRIORITY_CHANGED"] = "priority_changed";
    TicketAction["MESSAGE_ADDED"] = "message_added";
    TicketAction["ATTACHMENT_ADDED"] = "attachment_added";
    TicketAction["RESOLVED"] = "resolved";
    TicketAction["CLOSED"] = "closed";
    TicketAction["REOPENED"] = "reopened";
})(TicketAction || (exports.TicketAction = TicketAction = {}));
var TicketSortField;
(function (TicketSortField) {
    TicketSortField["CREATED_AT"] = "createdAt";
    TicketSortField["UPDATED_AT"] = "updatedAt";
    TicketSortField["PRIORITY"] = "priority";
    TicketSortField["STATUS"] = "status";
    TicketSortField["SLA_DEADLINE"] = "slaDeadline";
    TicketSortField["CUSTOMER_NAME"] = "customerName";
    TicketSortField["TITLE"] = "title";
})(TicketSortField || (exports.TicketSortField = TicketSortField = {}));
exports.DEFAULT_SLA_CONFIG = [
    {
        priority: TicketPriority.URGENT,
        responseTimeHours: 1,
        resolutionTimeHours: 4,
    },
    {
        priority: TicketPriority.HIGH,
        responseTimeHours: 4,
        resolutionTimeHours: 24,
    },
    {
        priority: TicketPriority.MEDIUM,
        responseTimeHours: 8,
        resolutionTimeHours: 48,
    },
    {
        priority: TicketPriority.LOW,
        responseTimeHours: 24,
        resolutionTimeHours: 72,
    },
];
// 工单状态流转规则
exports.TICKET_STATUS_TRANSITIONS = {
    [TicketStatus.OPEN]: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
    [TicketStatus.IN_PROGRESS]: [
        TicketStatus.PENDING,
        TicketStatus.RESOLVED,
        TicketStatus.OPEN,
    ],
    [TicketStatus.PENDING]: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
    [TicketStatus.RESOLVED]: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
    [TicketStatus.CLOSED]: [TicketStatus.OPEN],
};
