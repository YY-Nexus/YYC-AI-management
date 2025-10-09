"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cachedReconciliationService = exports.CachedReconciliationService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
const cache_service_1 = require("./cache.service");
const metrics_1 = require("../config/metrics");
const reconciliation_service_1 = require("./reconciliation.service");
class CachedReconciliationService extends reconciliation_service_1.ReconciliationService {
    constructor() {
        super(...arguments);
        this.CACHE_PREFIX = "reconciliation";
        this.CACHE_TTL = {
            records: 300, // 5 minutes
            stats: 60, // 1 minute
            rules: 600, // 10 minutes
            exceptions: 180, // 3 minutes
        };
    }
    /**
     * 获取对账记录列表（带缓存）
     */
    async getRecords(filters) {
        const cacheKey = `records:${JSON.stringify(filters)}`;
        return cache_service_1.cacheService.wrap(cacheKey, async () => {
            return this.fetchRecordsFromDb(filters);
        }, {
            prefix: this.CACHE_PREFIX,
            ttl: this.CACHE_TTL.records,
        });
    }
    /**
     * 获取单个对账记录（带缓存）
     */
    async getRecordById(recordId) {
        const cacheKey = `record:${recordId}`;
        return cache_service_1.cacheService.wrap(cacheKey, async () => {
            const query = `SELECT * FROM reconciliation_records WHERE id = $1`;
            const result = await database_1.pool.query(query, [recordId]);
            if (result.rows.length === 0) {
                return null;
            }
            return this.mapDbRecordToModel(result.rows[0]);
        }, {
            prefix: this.CACHE_PREFIX,
            ttl: this.CACHE_TTL.records,
        });
    }
    /**
     * 创建对账记录（清除相关缓存）
     */
    async createRecord(record) {
        const recordNumber = await this.generateRecordNumber();
        const query = `
      INSERT INTO reconciliation_records (
        record_number, transaction_date, transaction_type, amount, currency,
        description, status, bank_reference, invoice_number, customer_name,
        category, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
        const values = [
            recordNumber,
            record.transactionDate,
            record.transactionType,
            record.amount,
            record.currency,
            record.description,
            record.status,
            record.bankReference,
            record.invoiceNumber,
            record.customerName,
            record.category,
            record.notes,
            record.createdBy,
        ];
        const result = await database_1.pool.query(query, values);
        const created = this.mapDbRecordToModel(result.rows[0]);
        // 清除相关缓存
        await this.invalidateRecordsCaches();
        metrics_1.reconciliationProcessed.inc({ status: created.status, type: created.transactionType });
        logger_1.logger.info("Reconciliation record created", { recordNumber });
        return created;
    }
    /**
     * 更新对账记录（清除缓存）
     */
    async updateRecord(recordId, updates, userId) {
        const record = await this.getRecordById(recordId);
        if (!record) {
            return null;
        }
        const fields = [];
        const values = [];
        let paramIndex = 1;
        if (updates.status) {
            fields.push(`status = $${paramIndex}`);
            values.push(updates.status);
            paramIndex++;
            if (updates.status === "resolved") {
                fields.push(`resolved_at = CURRENT_TIMESTAMP`);
            }
        }
        if (updates.notes) {
            fields.push(`notes = $${paramIndex}`);
            values.push(updates.notes);
            paramIndex++;
        }
        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        const query = `
      UPDATE reconciliation_records
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
        values.push(recordId);
        const result = await database_1.pool.query(query, values);
        // 清除缓存
        await cache_service_1.cacheService.del(`record:${recordId}`, { prefix: this.CACHE_PREFIX });
        await this.invalidateRecordsCaches();
        return this.mapDbRecordToModel(result.rows[0]);
    }
    /**
     * 自动对账
     */
    async autoReconcile(userId) {
        logger_1.logger.info("Starting auto-reconciliation", { userId });
        const unmatchedRecords = await this.getUnmatchedRecords();
        const rules = await this.getActiveRules();
        let matched = 0;
        let failed = 0;
        for (const record of unmatchedRecords) {
            try {
                const match = await this.findMatch(record, rules);
                if (match) {
                    await this.createMatch(record.id, match.matchedRecordId, match.confidence, "automatic", userId);
                    await this.updateRecordStatus(record.id, "matched");
                    matched++;
                }
                else {
                    failed++;
                }
            }
            catch (error) {
                logger_1.logger.error("Auto-reconciliation error", { recordId: record.id, error });
                failed++;
            }
        }
        // 清除缓存
        await this.invalidateRecordsCaches();
        // 更新匹配率指标
        const stats = await this.getStats();
        metrics_1.reconciliationMatchRate.set(stats.matchRate);
        logger_1.logger.info("Auto-reconciliation completed", { processed: unmatchedRecords.length, matched, failed });
        return {
            processed: unmatchedRecords.length,
            matched,
            failed,
        };
    }
    /**
     * 获取统计信息（带缓存）
     */
    async getStats(filters) {
        const cacheKey = filters ? `stats:${JSON.stringify(filters)}` : "stats";
        return cache_service_1.cacheService.wrap(cacheKey, async () => {
            const query = `
          SELECT 
            COUNT(*) as total_records,
            SUM(CASE WHEN status = 'matched' THEN amount ELSE 0 END) as matched_amount,
            SUM(CASE WHEN status = 'unmatched' THEN amount ELSE 0 END) as unmatched_amount,
            SUM(CASE WHEN status = 'disputed' THEN amount ELSE 0 END) as disputed_amount,
            COUNT(CASE WHEN status = 'matched' THEN 1 END) as matched_count
          FROM reconciliation_records
        `;
            const result = await database_1.pool.query(query);
            const row = result.rows[0];
            const totalRecords = Number.parseInt(row.total_records);
            const matchedCount = Number.parseInt(row.matched_count);
            const matchRate = totalRecords > 0 ? (matchedCount / totalRecords) * 100 : 0;
            const exceptionQuery = `
          SELECT COUNT(*) as exception_count
          FROM reconciliation_exceptions
          WHERE resolution_status IN ('pending', 'investigating')
        `;
            const exceptionResult = await database_1.pool.query(exceptionQuery);
            const exceptionCount = Number.parseInt(exceptionResult.rows[0].exception_count);
            return {
                totalRecords,
                matchedAmount: Number.parseFloat(row.matched_amount) || 0,
                unmatchedAmount: Number.parseFloat(row.unmatched_amount) || 0,
                disputedAmount: Number.parseFloat(row.disputed_amount) || 0,
                matchRate: Math.round(matchRate * 100) / 100,
                exceptionCount,
            };
        }, {
            prefix: this.CACHE_PREFIX,
            ttl: this.CACHE_TTL.stats,
        });
    }
    /**
     * 创建异常记录
     */
    async createException(exception) {
        const query = `
      INSERT INTO reconciliation_exceptions (
        record_id, exception_type, severity, description, resolution_status, assigned_to
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
        const values = [
            exception.recordId,
            exception.exceptionType,
            exception.severity,
            exception.description,
            exception.resolutionStatus,
            exception.assignedTo,
        ];
        const result = await database_1.pool.query(query, values);
        const created = this.mapDbExceptionToModel(result.rows[0]);
        // 清除异常列表缓存
        await cache_service_1.cacheService.delPattern("exceptions:*", { prefix: this.CACHE_PREFIX });
        metrics_1.exceptionsTotal.inc({ exception_type: created.exceptionType, severity: created.severity });
        logger_1.logger.info("Exception created", { exceptionId: created.id, recordId: created.recordId });
        return created;
    }
    /**
     * 获取异常列表（带缓存）
     */
    async getExceptions(filters) {
        const cacheKey = `exceptions:${JSON.stringify(filters)}`;
        return cache_service_1.cacheService.wrap(cacheKey, async () => {
            return this.fetchExceptionsFromDb(filters);
        }, {
            prefix: this.CACHE_PREFIX,
            ttl: this.CACHE_TTL.exceptions,
        });
    }
    /**
     * 解决异常（清除缓存）
     */
    async resolveException(exceptionId, resolutionNotes, userId) {
        const query = `
      UPDATE reconciliation_exceptions
      SET resolution_status = 'resolved',
          resolution_notes = $1,
          resolved_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
        const result = await database_1.pool.query(query, [resolutionNotes, exceptionId]);
        if (result.rows.length === 0) {
            return null;
        }
        // 清除异常缓存
        await cache_service_1.cacheService.delPattern("exceptions:*", { prefix: this.CACHE_PREFIX });
        return this.mapDbExceptionToModel(result.rows[0]);
    }
    /**
     * 批量匹配对账（清除缓存）
     */
    async bulkMatch(filters) {
        const result = await super.bulkMatch(filters);
        // 清除所有相关缓存
        await this.invalidateAllCache();
        return result;
    }
    // 私有辅助方法
    async fetchRecordsFromDb(filters) {
        const { status, startDate, endDate, customerName, limit = 50, offset = 0 } = filters;
        let query = `
      SELECT * FROM reconciliation_records
      WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;
        if (status) {
            query += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        if (startDate) {
            query += ` AND transaction_date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            query += ` AND transaction_date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        if (customerName) {
            query += ` AND customer_name ILIKE $${paramIndex}`;
            params.push(`%${customerName}%`);
            paramIndex++;
        }
        const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_query`;
        const countResult = await database_1.pool.query(countQuery, params);
        const total = Number.parseInt(countResult.rows[0].count);
        query += ` ORDER BY transaction_date DESC, created_at DESC`;
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        const result = await database_1.pool.query(query, params);
        return {
            records: result.rows.map(this.mapDbRecordToModel),
            total,
        };
    }
    async fetchExceptionsFromDb(filters) {
        const { status, severity, limit = 50, offset = 0 } = filters;
        let query = `
      SELECT * FROM reconciliation_exceptions
      WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;
        if (status) {
            query += ` AND resolution_status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        if (severity) {
            query += ` AND severity = $${paramIndex}`;
            params.push(severity);
            paramIndex++;
        }
        const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_query`;
        const countResult = await database_1.pool.query(countQuery, params);
        const total = Number.parseInt(countResult.rows[0].count);
        query += ` ORDER BY created_at DESC`;
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        const result = await database_1.pool.query(query, params);
        return {
            exceptions: result.rows.map(this.mapDbExceptionToModel),
            total,
        };
    }
    async invalidateRecordsCaches() {
        await Promise.all([
            cache_service_1.cacheService.delPattern("records:*", { prefix: this.CACHE_PREFIX }),
            cache_service_1.cacheService.delPattern("stats", { prefix: this.CACHE_PREFIX }),
        ]);
    }
    async getUnmatchedRecords() {
        const cacheKey = "records:unmatched";
        return cache_service_1.cacheService.wrap(cacheKey, async () => {
            const query = `
          SELECT * FROM reconciliation_records
          WHERE status = 'unmatched'
          ORDER BY transaction_date DESC
          LIMIT 1000
        `;
            const result = await database_1.pool.query(query);
            return result.rows.map(this.mapDbRecordToModel);
        }, {
            prefix: this.CACHE_PREFIX,
            ttl: this.CACHE_TTL.records,
        });
    }
    async getActiveRules() {
        const cacheKey = "rules:active";
        return cache_service_1.cacheService.wrap(cacheKey, async () => {
            const query = `
          SELECT * FROM reconciliation_rules
          WHERE is_active = true
          ORDER BY priority ASC
        `;
            const result = await database_1.pool.query(query);
            return result.rows.map(this.mapDbRuleToModel);
        }, {
            prefix: this.CACHE_PREFIX,
            ttl: this.CACHE_TTL.rules,
        });
    }
    async findMatch(record, rules) {
        for (const rule of rules) {
            if (rule.ruleType === "amount_match") {
                const match = await this.findAmountMatch(record, rule.amountTolerance);
                if (match)
                    return match;
            }
        }
        return null;
    }
    async findAmountMatch(record, tolerance) {
        const query = `
      SELECT id FROM reconciliation_records
      WHERE id != $1
      AND status = 'unmatched'
      AND ABS(amount - $2) <= $3
      AND transaction_type != $4
      AND transaction_date BETWEEN $5 AND $6
      LIMIT 1
    `;
        const startDate = new Date(record.transactionDate);
        startDate.setDate(startDate.getDate() - 3);
        const endDate = new Date(record.transactionDate);
        endDate.setDate(endDate.getDate() + 3);
        const result = await database_1.pool.query(query, [
            record.id,
            record.amount,
            tolerance,
            record.transactionType,
            startDate,
            endDate,
        ]);
        if (result.rows.length > 0) {
            return {
                matchedRecordId: result.rows[0].id,
                confidence: 85,
            };
        }
        return null;
    }
    async createMatch(recordId, matchedRecordId, confidence, matchType, userId) {
        const query = `
      INSERT INTO reconciliation_matches (
        record_id, matched_record_id, match_confidence, match_type, matched_by
      ) VALUES ($1, $2, $3, $4, $5)
    `;
        await database_1.pool.query(query, [recordId, matchedRecordId, confidence, matchType, userId]);
    }
    async updateRecordStatus(recordId, status) {
        const query = `
      UPDATE reconciliation_records
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
        await database_1.pool.query(query, [status, recordId]);
    }
    mapDbRecordToModel(row) {
        return {
            id: row.id,
            recordNumber: row.record_number,
            transactionDate: row.transaction_date,
            transactionType: row.transaction_type,
            amount: Number.parseFloat(row.amount),
            currency: row.currency,
            description: row.description,
            status: row.status,
            bankReference: row.bank_reference,
            invoiceNumber: row.invoice_number,
            customerName: row.customer_name,
            category: row.category,
            notes: row.notes,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            resolvedAt: row.resolved_at,
        };
    }
    mapDbRuleToModel(row) {
        return {
            id: row.id,
            ruleName: row.rule_name,
            ruleType: row.rule_type,
            amountTolerance: Number.parseFloat(row.amount_tolerance),
            dateToleranceDays: row.date_tolerance_days,
            isActive: row.is_active,
            priority: row.priority,
        };
    }
    mapDbExceptionToModel(row) {
        return {
            id: row.id,
            recordId: row.record_id,
            exceptionType: row.exception_type,
            severity: row.severity,
            description: row.description,
            resolutionStatus: row.resolution_status,
            assignedTo: row.assigned_to,
            resolvedAt: row.resolved_at,
            resolutionNotes: row.resolution_notes,
            createdAt: row.created_at,
        };
    }
    async invalidateListCache() {
        try {
            const deleted = await cache_service_1.cacheService.delPattern("list:*", {
                prefix: this.CACHE_PREFIX,
            });
            logger_1.logger.debug("Invalidated list cache", { deleted });
        }
        catch (error) {
            logger_1.logger.error("Failed to invalidate list cache", { error });
        }
    }
    async invalidateAllCache() {
        try {
            const deleted = await cache_service_1.cacheService.delPattern("*", {
                prefix: this.CACHE_PREFIX,
            });
            logger_1.logger.info("Invalidated all reconciliation cache", { deleted });
        }
        catch (error) {
            logger_1.logger.error("Failed to invalidate all cache", { error });
        }
    }
}
exports.CachedReconciliationService = CachedReconciliationService;
exports.cachedReconciliationService = new CachedReconciliationService();
