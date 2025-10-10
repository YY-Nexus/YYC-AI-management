"use strict";
const { pool } = require('../config/database');
const { logger } = require('../config/logger');
class TicketService {
    /**
     * 获取工单列表
     */
    async getTickets(filters) {
        const { status, priority, assignedTo, limit = 50, offset = 0 } = filters;
        let query = `
      SELECT 
        t.*,
        COUNT(m.id) as message_count,
        MAX(m.timestamp) as last_message_at
      FROM support_tickets t
      LEFT JOIN ticket_messages m ON t.id = m.ticket_id
      WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;
        if (status) {
            query += ` AND t.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        if (priority) {
            query += ` AND t.priority = $${paramIndex}`;
            params.push(priority);
            paramIndex++;
        }
        if (assignedTo) {
            query += ` AND t.assigned_to = $${paramIndex}`;
            params.push(assignedTo);
            paramIndex++;
        }
        query += ` GROUP BY t.id`;
        // 获取总数
        const countQuery = `SELECT COUNT(DISTINCT t.id) FROM support_tickets t WHERE 1=1 ${status ? "AND t.status = $1" : ""}`;
        const countParams = status ? [status] : [];
        const countResult = await pool.query(countQuery, countParams);
        const total = Number.parseInt(countResult.rows[0].count);
        // 添加排序和分页
        query += ` ORDER BY t.created_at DESC`;
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        const result = await pool.query(query, params);
        // 加载每个工单的消息
        const tickets = await Promise.all(result.rows.map(async (row) => {
            const messages = await this.getTicketMessages(row.id);
            return this.mapDbTicketToModel(row, messages);
        }));
        return { tickets, total };
    }
    /**
     * 根据ID获取工单
     */
    async getTicketById(ticketId) {
        const query = `
      SELECT * FROM support_tickets
      WHERE id = $1
    `;
        const result = await pool.query(query, [ticketId]);
        if (result.rows.length === 0) {
            return null;
        }
        const messages = await this.getTicketMessages(ticketId);
        return this.mapDbTicketToModel(result.rows[0], messages);
    }
    /**
     * 创建工单
     */
    async createTicket(ticket) {
        const ticketNumber = await this.generateTicketNumber();
        const dueDate = this.calculateDueDate(ticket.priority);
        const query = `
      INSERT INTO support_tickets (
        ticket_number, title, description, category, priority, status,
        customer_name, customer_email, customer_phone, due_date, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
        const values = [
            ticketNumber,
            ticket.title,
            ticket.description,
            ticket.category,
            ticket.priority,
            "open",
            ticket.customerName,
            ticket.customerEmail,
            ticket.customerPhone,
            dueDate,
            ticket.createdBy,
        ];
        const result = await pool.query(query, values);
        const created = this.mapDbTicketToModel(result.rows[0], []);
        // 创建初始消息
        await this.addMessage(created.id, {
            authorId: "customer",
            authorName: ticket.customerName,
            isInternal: false,
            content: ticket.description,
        });
        logger.info("Ticket created", { ticketNumber, priority: ticket.priority });
        return created;
    }
    /**
     * 更新工单
     */
    async updateTicket(ticketId, updates, userId) {
        const ticket = await this.getTicketById(ticketId);
        if (!ticket) {
            return null;
        }
        const fields = [];
        const values = [];
        let paramIndex = 1;
        if (updates.status) {
            fields.push(`status = $${paramIndex}`);
            values.push(updates.status);
            paramIndex++;
            // 如果标记为已解决，记录解决时间
            if (updates.status === "resolved" || updates.status === "closed") {
                fields.push(`resolved_at = CURRENT_TIMESTAMP`);
            }
        }
        if (updates.priority) {
            fields.push(`priority = $${paramIndex}`);
            values.push(updates.priority);
            paramIndex++;
            // 重新计算截止日期
            const newDueDate = this.calculateDueDate(updates.priority);
            fields.push(`due_date = $${paramIndex}`);
            values.push(newDueDate);
            paramIndex++;
        }
        if (updates.assignedTo) {
            fields.push(`assigned_to = $${paramIndex}`);
            values.push(updates.assignedTo);
            paramIndex++;
            // 如果是首次分配，记录为处理中
            if (!ticket.assignedTo) {
                fields.push(`status = 'in-progress'`);
            }
        }
        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        const query = `
      UPDATE support_tickets
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
        values.push(ticketId);
        const result = await pool.query(query, values);
        // 记录审计日志
        await this.logAudit(ticketId, "update", ticket, result.rows[0], userId);
        // 检查SLA违规
        if (updates.status === "resolved") {
            const responseTime = (result.rows[0].resolved_at - result.rows[0].created_at) / 1000 / 60 / 60; // 小时
            const slaHours = this.getSlaHours(ticket.priority);
            if (responseTime > slaHours) {
                logger.info("SLA violation detected", { ticketId, priority: ticket.priority, responseTime, slaHours });
            }
        }
        const messages = await this.getTicketMessages(ticketId);
        return this.mapDbTicketToModel(result.rows[0], messages);
    }
    /**
     * 添加工单消息
     */
    async addMessage(ticketId, message) {
        const query = `
      INSERT INTO ticket_messages (
        ticket_id, sender, sender_name, sender_type, content, is_internal, attachments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
        const values = [
            ticketId,
            message.authorId,
            message.authorName,
            message.authorId === 'system' ? 'system' : 'user', // 默认为user类型
            message.content,
            message.isInternal || false,
            JSON.stringify(message.attachments || [])
        ];
        const result = await pool.query(query, values);
        const createdMessage = this.mapDbMessageToModel(result.rows[0]);
        logger.info("Message added to ticket", { ticketId, sender: message.authorId });
        return createdMessage;
    }
    /**
     * 获取工单统计
     */
    async getStats() {
        const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open,
        COUNT(CASE WHEN status = 'in-progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_hours,
        AVG(satisfaction) FILTER (WHERE satisfaction IS NOT NULL) as avg_satisfaction
      FROM support_tickets
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;
        const result = await pool.query(query);
        const row = result.rows[0];
        return {
            total: Number.parseInt(row.total),
            open: Number.parseInt(row.open),
            inProgress: Number.parseInt(row.in_progress),
            pending: Number.parseInt(row.pending),
            resolved: Number.parseInt(row.resolved),
            closed: Number.parseInt(row.closed),
            averageResolutionTime: row.avg_resolution_hours ? Math.round(row.avg_resolution_hours * 10) / 10 : 0,
            // 添加缺少的字段
            overdue: 0,
            slaCompliance: 100,
        };
    }
    // 私有方法
    async getTicketMessages(ticketId) {
        const query = `
      SELECT * FROM ticket_messages
      WHERE ticket_id = $1
      ORDER BY timestamp ASC
    `;
        const result = await pool.query(query, [ticketId]);
        return result.rows.map(this.mapDbMessageToModel.bind(this));
    }
    async generateTicketNumber() {
        const year = new Date().getFullYear();
        const query = `
      SELECT COUNT(*) as count 
      FROM support_tickets 
      WHERE ticket_number LIKE $1
    `;
        const result = await pool.query(query, [`TKT-${year}-%`]);
        const count = Number.parseInt(result.rows[0].count) + 1;
        return `TKT-${year}-${String(count).padStart(4, "0")}`;
    }
    calculateDueDate(priority) {
        const now = new Date();
        const hours = this.getSlaHours(priority);
        return new Date(now.getTime() + hours * 60 * 60 * 1000);
    }
    getSlaHours(priority) {
        const slaMap = {
            urgent: 4,
            high: 8,
            medium: 24,
            low: 72,
        };
        return slaMap[priority] || 24;
    }
    async logAudit(ticketId, action, oldValue, newValue, userId) {
        const query = `
      INSERT INTO ticket_audit_log (
        ticket_id, action, old_value, new_value, performed_by
      ) VALUES ($1, $2, $3, $4, $5)
    `;
        await pool.query(query, [ticketId, action, JSON.stringify(oldValue), JSON.stringify(newValue), userId]);
    }
    mapDbTicketToModel(row, messages) {
        return {
            id: row.id,
            ticketNumber: row.ticket_number,
            title: row.title,
            description: row.description,
            category: row.category,
            priority: row.priority,
            status: row.status,
            createdBy: row.created_by || 'system',
            assignedTo: row.assigned_to,
            customerName: row.customer_name,
            customerEmail: row.customer_email,
            customerPhone: row.customer_phone,
            tags: row.tags || [],
            slaDeadline: row.due_date,
            resolvedAt: row.resolved_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    mapDbMessageToModel(row) {
        return {
            id: row.id,
            ticketId: row.ticket_id,
            content: row.content,
            authorId: row.sender,
            authorName: row.sender_name,
            isInternal: row.is_internal,
            attachments: row.attachments,
            createdAt: row.timestamp,
        };
    }
}
// 导出服务
module.exports = TicketService;
module.exports.TicketService = TicketService;
