import { pool } from "../config/database"
import { logger } from "../config/logger"
import { ticketsProcessed, ticketResponseTime, slaViolations } from "../config/metrics"
import type { SupportTicket, TicketMessage, TicketStats } from "../types/ticket"

export class TicketService {
  /**
   * 获取工单列表
   */
  async getTickets(filters: {
    status?: string
    priority?: string
    assignedTo?: string
    limit?: number
    offset?: number
  }): Promise<{ tickets: SupportTicket[]; total: number }> {
    const { status, priority, assignedTo, limit = 50, offset = 0 } = filters

    let query = `
      SELECT 
        t.*,
        COUNT(m.id) as message_count,
        MAX(m.timestamp) as last_message_at
      FROM support_tickets t
      LEFT JOIN ticket_messages m ON t.id = m.ticket_id
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    if (status) {
      query += ` AND t.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (priority) {
      query += ` AND t.priority = $${paramIndex}`
      params.push(priority)
      paramIndex++
    }

    if (assignedTo) {
      query += ` AND t.assigned_to = $${paramIndex}`
      params.push(assignedTo)
      paramIndex++
    }

    query += ` GROUP BY t.id`

    // 获取总数
    const countQuery = `SELECT COUNT(DISTINCT t.id) FROM support_tickets t WHERE 1=1 ${status ? "AND t.status = $1" : ""}`
    const countParams = status ? [status] : []
    const countResult = await pool.query(countQuery, countParams)
    const total = Number.parseInt(countResult.rows[0].count)

    // 添加排序和分页
    query += ` ORDER BY t.created_at DESC`
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await pool.query(query, params)

    // 加载每个工单的消息
    const tickets = await Promise.all(
      result.rows.map(async (row) => {
        const messages = await this.getTicketMessages(row.id)
        return this.mapDbTicketToModel(row, messages)
      }),
    )

    return { tickets, total }
  }

  /**
   * 根据ID获取工单
   */
  async getTicketById(ticketId: string): Promise<SupportTicket | null> {
    const query = `
      SELECT * FROM support_tickets
      WHERE id = $1
    `
    const result = await pool.query(query, [ticketId])

    if (result.rows.length === 0) {
      return null
    }

    const messages = await this.getTicketMessages(ticketId)
    return this.mapDbTicketToModel(result.rows[0], messages)
  }

  /**
   * 创建工单
   */
  async createTicket(
    ticket: Omit<SupportTicket, "id" | "ticketNumber" | "createdAt" | "updatedAt" | "messages">,
  ): Promise<SupportTicket> {
    const ticketNumber = await this.generateTicketNumber()
    const dueDate = this.calculateDueDate(ticket.priority)

    const query = `
      INSERT INTO support_tickets (
        ticket_number, title, description, category, priority, status,
        customer_name, customer_email, customer_phone, due_date, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `

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
    ]

    const result = await pool.query(query, values)
    const created = this.mapDbTicketToModel(result.rows[0], [])

    ticketsProcessed.inc({ status: "created", priority: created.priority })

    // 创建初始消息
    await this.addMessage(created.id, {
      sender: "customer",
      senderName: ticket.customerName,
      senderType: "customer",
      content: ticket.description,
    })

    logger.info("Ticket created", { ticketNumber, priority: ticket.priority })

    return created
  }

  /**
   * 更新工单
   */
  async updateTicket(
    ticketId: string,
    updates: Partial<Pick<SupportTicket, "status" | "priority" | "assignedTo" | "notes">>,
    userId: string,
  ): Promise<SupportTicket | null> {
    const ticket = await this.getTicketById(ticketId)
    if (!ticket) {
      return null
    }

    const fields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (updates.status) {
      fields.push(`status = $${paramIndex}`)
      values.push(updates.status)
      paramIndex++

      // 如果标记为已解决，记录解决时间
      if (updates.status === "resolved" || updates.status === "closed") {
        fields.push(`resolved_at = CURRENT_TIMESTAMP`)
      }
    }

    if (updates.priority) {
      fields.push(`priority = $${paramIndex}`)
      values.push(updates.priority)
      paramIndex++

      // 重新计算截止日期
      const newDueDate = this.calculateDueDate(updates.priority)
      fields.push(`due_date = $${paramIndex}`)
      values.push(newDueDate)
      paramIndex++
    }

    if (updates.assignedTo) {
      fields.push(`assigned_to = $${paramIndex}`)
      values.push(updates.assignedTo)
      paramIndex++

      // 如果是首次分配，记录为处理中
      if (!ticket.assignedTo) {
        fields.push(`status = 'in-progress'`)
      }
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`)

    const query = `
      UPDATE support_tickets
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `
    values.push(ticketId)

    const result = await pool.query(query, values)

    // 记录审计日志
    await this.logAudit(ticketId, "update", ticket, result.rows[0], userId)

    // 检查SLA违规
    if (updates.status === "resolved") {
      const responseTime = (result.rows[0].resolved_at - result.rows[0].created_at) / 1000 / 60 / 60 // 小时
      ticketResponseTime.observe({ priority: ticket.priority }, responseTime)

      const slaHours = this.getSlaHours(ticket.priority)
      if (responseTime > slaHours) {
        slaViolations.inc({ priority: ticket.priority })
      }
    }

    const messages = await this.getTicketMessages(ticketId)
    return this.mapDbTicketToModel(result.rows[0], messages)
  }

  /**
   * 添加工单消息
   */
  async addMessage(
    ticketId: string,
    message: Omit<TicketMessage, "id" | "ticketId" | "timestamp">,
  ): Promise<TicketMessage> {
    const query = `
      INSERT INTO ticket_messages (
        ticket_id, sender, sender_name, sender_type, content, is_internal
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `

    const values = [
      ticketId,
      message.sender,
      message.senderName,
      message.senderType,
      message.content,
      message.isInternal || false,
    ]

    const result = await pool.query(query, values)

    // 更新工单的更新时间
    await pool.query(`UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [ticketId])

    return this.mapDbMessageToModel(result.rows[0])
  }

  /**
   * 获取工单统计
   */
  async getStats(): Promise<TicketStats> {
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
    `

    const result = await pool.query(query)
    const row = result.rows[0]

    return {
      total: Number.parseInt(row.total),
      open: Number.parseInt(row.open),
      inProgress: Number.parseInt(row.in_progress),
      pending: Number.parseInt(row.pending),
      resolved: Number.parseInt(row.resolved),
      closed: Number.parseInt(row.closed),
      avgResolutionTime: row.avg_resolution_hours ? `${Math.round(row.avg_resolution_hours * 10) / 10}h` : "N/A",
      satisfactionRate: row.avg_satisfaction ? `${Math.round(row.avg_satisfaction * 10) / 10}/5.0` : "N/A",
    }
  }

  // 私有方法

  private async getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
    const query = `
      SELECT * FROM ticket_messages
      WHERE ticket_id = $1
      ORDER BY timestamp ASC
    `
    const result = await pool.query(query, [ticketId])
    return result.rows.map(this.mapDbMessageToModel)
  }

  private async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear()
    const query = `
      SELECT COUNT(*) as count 
      FROM support_tickets 
      WHERE ticket_number LIKE $1
    `
    const result = await pool.query(query, [`TKT-${year}-%`])
    const count = Number.parseInt(result.rows[0].count) + 1
    return `TKT-${year}-${String(count).padStart(4, "0")}`
  }

  private calculateDueDate(priority: string): Date {
    const now = new Date()
    const hours = this.getSlaHours(priority)
    return new Date(now.getTime() + hours * 60 * 60 * 1000)
  }

  private getSlaHours(priority: string): number {
    const slaMap: Record<string, number> = {
      urgent: 4,
      high: 8,
      medium: 24,
      low: 72,
    }
    return slaMap[priority] || 24
  }

  private async logAudit(
    ticketId: string,
    action: string,
    oldValue: any,
    newValue: any,
    userId: string,
  ): Promise<void> {
    const query = `
      INSERT INTO ticket_audit_log (
        ticket_id, action, old_value, new_value, performed_by
      ) VALUES ($1, $2, $3, $4, $5)
    `
    await pool.query(query, [ticketId, action, JSON.stringify(oldValue), JSON.stringify(newValue), userId])
  }

  private mapDbTicketToModel(row: any, messages: TicketMessage[]): SupportTicket {
    return {
      id: row.id,
      ticketNumber: row.ticket_number,
      title: row.title,
      description: row.description,
      category: row.category,
      priority: row.priority,
      status: row.status,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
      dueDate: row.due_date,
      tags: row.tags || [],
      attachments: row.attachments || [],
      messages,
      satisfaction: row.satisfaction,
      resolution: row.resolution,
    }
  }

  private mapDbMessageToModel(row: any): TicketMessage {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      sender: row.sender,
      senderName: row.sender_name,
      senderType: row.sender_type,
      content: row.content,
      timestamp: row.timestamp,
      attachments: row.attachments,
      isInternal: row.is_internal,
    }
  }
}
