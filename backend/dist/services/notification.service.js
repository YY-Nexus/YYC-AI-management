"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationEvent = void 0;
const redis_pubsub_service_1 = require("./redis-pubsub.service");
const server_1 = require("../server");
const logger_1 = require("../config/logger");
const metrics_1 = require("../config/metrics");
var NotificationEvent;
(function (NotificationEvent) {
    // AI 分析事件
    NotificationEvent["AI_ANALYSIS_STARTED"] = "ai:analysis:started";
    NotificationEvent["AI_ANALYSIS_COMPLETED"] = "ai:analysis:completed";
    NotificationEvent["AI_ANALYSIS_FAILED"] = "ai:analysis:failed";
    // 对账事件
    NotificationEvent["RECONCILIATION_STARTED"] = "reconciliation:started";
    NotificationEvent["RECONCILIATION_COMPLETED"] = "reconciliation:completed";
    NotificationEvent["RECONCILIATION_MATCHED"] = "reconciliation:matched";
    NotificationEvent["RECONCILIATION_UNMATCHED"] = "reconciliation:unmatched";
    // 工单事件
    NotificationEvent["TICKET_CREATED"] = "ticket:created";
    NotificationEvent["TICKET_UPDATED"] = "ticket:updated";
    NotificationEvent["TICKET_RESOLVED"] = "ticket:resolved";
    // 系统事件
    NotificationEvent["SYSTEM_ALERT"] = "system:alert";
    NotificationEvent["SYSTEM_WARNING"] = "system:warning";
})(NotificationEvent || (exports.NotificationEvent = NotificationEvent = {}));
class NotificationService {
    /**
     * 初始化通知服务
     */
    async initialize() {
        try {
            // 订阅 AI 分析频道
            await redis_pubsub_service_1.pubSubService.subscribe(redis_pubsub_service_1.RedisChannel.AI_ANALYSIS);
            await redis_pubsub_service_1.pubSubService.subscribe(redis_pubsub_service_1.RedisChannel.RECONCILIATION);
            await redis_pubsub_service_1.pubSubService.subscribe(redis_pubsub_service_1.RedisChannel.NOTIFICATION);
            // 监听 AI 分析事件
            redis_pubsub_service_1.pubSubService.on(redis_pubsub_service_1.RedisChannel.AI_ANALYSIS, (message) => {
                this.handleAIAnalysisEvent(message);
            });
            // 监听对账事件
            redis_pubsub_service_1.pubSubService.on(redis_pubsub_service_1.RedisChannel.RECONCILIATION, (message) => {
                this.handleReconciliationEvent(message);
            });
            // 监听通用通知事件
            redis_pubsub_service_1.pubSubService.on(redis_pubsub_service_1.RedisChannel.NOTIFICATION, (message) => {
                this.handleNotificationEvent(message);
            });
            logger_1.logger.info("[Notification Service] Initialized successfully");
        }
        catch (error) {
            logger_1.logger.error("[Notification Service] Initialization failed", { error });
            throw error;
        }
    }
    /**
     * 处理 AI 分析事件
     */
    async handleAIAnalysisEvent(message) {
        try {
            const { event, data, userId } = message;
            let notification;
            switch (event) {
                case NotificationEvent.AI_ANALYSIS_STARTED:
                    notification = {
                        id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        title: "AI 分析已启动",
                        message: `正在分析 ${data.recordCount} 条异常记录...`,
                        type: "info",
                        priority: "medium",
                        data,
                        userId,
                        actionUrl: `/finance/reconciliation/${data.reconciliationId}`,
                    };
                    break;
                case NotificationEvent.AI_ANALYSIS_COMPLETED:
                    notification = {
                        id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        title: "AI 分析完成",
                        message: `成功分析 ${data.analysisCount} 条记录，发现 ${data.issueCount} 个问题`,
                        type: "success",
                        priority: "medium",
                        data,
                        userId,
                        actionUrl: `/finance/reconciliation/${data.reconciliationId}`,
                    };
                    metrics_1.aiAnalysisTotal.inc();
                    break;
                case NotificationEvent.AI_ANALYSIS_FAILED:
                    notification = {
                        id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        title: "AI 分析失败",
                        message: data.error || "分析过程中出现错误",
                        type: "error",
                        priority: "high",
                        data,
                        userId,
                        actionUrl: `/finance/reconciliation/${data.reconciliationId}`,
                    };
                    metrics_1.aiAnalysisErrors.inc();
                    break;
                default:
                    logger_1.logger.warn(`[Notification Service] Unknown AI analysis event: ${event}`);
                    return;
            }
            // 发送通知
            await this.sendNotification(notification);
        }
        catch (error) {
            logger_1.logger.error("[Notification Service] Failed to handle AI analysis event", { error });
        }
    }
    /**
     * 处理对账事件
     */
    async handleReconciliationEvent(message) {
        try {
            const { event, data, userId } = message;
            let notification;
            switch (event) {
                case NotificationEvent.RECONCILIATION_STARTED:
                    notification = {
                        id: `recon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        title: "对账任务已启动",
                        message: `开始处理 ${data.recordCount} 条记录`,
                        type: "info",
                        priority: "low",
                        data,
                        userId,
                    };
                    break;
                case NotificationEvent.RECONCILIATION_COMPLETED:
                    notification = {
                        id: `recon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        title: "对账完成",
                        message: `匹配 ${data.matchedCount} 条，未匹配 ${data.unmatchedCount} 条`,
                        type: "success",
                        priority: "medium",
                        data,
                        userId,
                    };
                    break;
                case NotificationEvent.RECONCILIATION_UNMATCHED:
                    notification = {
                        id: `recon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        title: "发现未匹配记录",
                        message: `有 ${data.unmatchedCount} 条记录需要人工处理`,
                        type: "warning",
                        priority: "high",
                        data,
                        userId,
                    };
                    break;
                default:
                    return;
            }
            await this.sendNotification(notification);
        }
        catch (error) {
            logger_1.logger.error("[Notification Service] Failed to handle reconciliation event", { error });
        }
    }
    /**
     * 处理通用通知事件
     */
    async handleNotificationEvent(message) {
        try {
            const { data } = message;
            await this.sendNotification(data);
        }
        catch (error) {
            logger_1.logger.error("[Notification Service] Failed to handle notification event", { error });
        }
    }
    /**
     * 发送通知
     */
    async sendNotification(payload) {
        try {
            if (payload.userId) {
                // 发送给特定用户
                server_1.wsService.sendNotificationToUser(payload.userId, payload);
            }
            else {
                // 广播给所有用户
                server_1.wsService.broadcastToRole("admin", {
                    type: "notification",
                    payload,
                    timestamp: new Date().toISOString()
                });
                server_1.wsService.broadcastToRole("support", {
                    type: "notification",
                    payload,
                    timestamp: new Date().toISOString()
                });
            }
            logger_1.logger.info("[Notification Service] Notification sent", {
                title: payload.title,
                type: payload.type,
                userId: payload.userId,
            });
        }
        catch (error) {
            logger_1.logger.error("[Notification Service] Failed to send notification", { error });
        }
    }
    /**
     * 发送自定义通知
     */
    async notify(payload) {
        await redis_pubsub_service_1.pubSubService.publish(redis_pubsub_service_1.RedisChannel.NOTIFICATION, {
            event: NotificationEvent.SYSTEM_ALERT,
            data: payload,
            timestamp: Date.now(),
            userId: payload.userId,
        });
    }
    /**
     * 发送 AI 分析开始通知
     */
    async notifyAIAnalysisStarted(reconciliationId, recordCount, userId) {
        await redis_pubsub_service_1.pubSubService.publish(redis_pubsub_service_1.RedisChannel.AI_ANALYSIS, {
            event: NotificationEvent.AI_ANALYSIS_STARTED,
            data: { reconciliationId, recordCount },
            timestamp: Date.now(),
            userId,
        });
    }
    /**
     * 发送 AI 分析完成通知
     */
    async notifyAIAnalysisCompleted(reconciliationId, analysisCount, issueCount, userId) {
        await redis_pubsub_service_1.pubSubService.publish(redis_pubsub_service_1.RedisChannel.AI_ANALYSIS, {
            event: NotificationEvent.AI_ANALYSIS_COMPLETED,
            data: { reconciliationId, analysisCount, issueCount },
            timestamp: Date.now(),
            userId,
        });
    }
    /**
     * 发送 AI 分析失败通知
     */
    async notifyAIAnalysisFailed(reconciliationId, error, userId) {
        await redis_pubsub_service_1.pubSubService.publish(redis_pubsub_service_1.RedisChannel.AI_ANALYSIS, {
            event: NotificationEvent.AI_ANALYSIS_FAILED,
            data: { reconciliationId, error },
            timestamp: Date.now(),
            userId,
        });
    }
}
exports.notificationService = new NotificationService();
