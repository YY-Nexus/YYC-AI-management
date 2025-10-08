// 数据警报系统组件 - 安全版本"use client"

import React, { useState, useEffect } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";import { useState, useCallback } from "react"

import { Badge } from "@/components/ui/badge";import {

import { Button } from "@/components/ui/button";  AlertTriangle,

import { Bell, AlertTriangle, CheckCircle, XCircle, Settings } from "lucide-react";  Bell,

  Mail,

// 警报配置接口  MessageSquare,

interface AlertConfig {  Webhook,

  id: string;  Plus,

  type: "email" | "sms" | "webhook" | "dingtalk";  Trash2,

  name: string;  Edit,

  config: {  Play,

    [key: string]: any;  Settings,

  };  Clock,

  enabled: boolean;  TrendingUp,

}  BarChart3,

  Shield,

// 示例警报配置（使用占位符，无敏感信息）  CheckCircle,

const alertConfigs: AlertConfig[] = [  XCircle,

  {  Save,

    id: "email-admin",  Copy,

    type: "email",  Download,

    name: "管理员邮箱",  Filter,

    config: {  Search,

      recipients: ["admin@example.com", "ops@example.com"],  Target,

      template: "default",  Activity,

    },  Smartphone,

    enabled: true,} from "lucide-react"

  },

  {import { Button } from "@/components/ui/button"

    id: "sms-urgent",import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"

    type: "sms",import { Badge } from "@/components/ui/badge"

    name: "紧急短信",import { Input } from "@/components/ui/input"

    config: {import { Label } from "@/components/ui/label"

      recipients: ["+86138****8888", "+86139****9999"],import { Textarea } from "@/components/ui/textarea"

    },import { Switch } from "@/components/ui/switch"

    enabled: true,import { Slider } from "@/components/ui/slider"

  },import { Progress } from "@/components/ui/progress"

  {import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

    id: "webhook-slack",import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

    type: "webhook",import {

    name: "Slack通知",  Dialog,

    config: {  DialogContent,

      url: "https://hooks.slack.com/services/YOUR_WORKSPACE/YOUR_CHANNEL/YOUR_WEBHOOK_TOKEN",  DialogDescription,

      template: "slack",  DialogFooter,

    },  DialogHeader,

    enabled: true,  DialogTitle,

  },  DialogTrigger,

  {} from "@/components/ui/dialog"

    id: "dingtalk-ops",import {

    type: "dingtalk",  DropdownMenu,

    name: "钉钉运维群",  DropdownMenuContent,

    config: {  DropdownMenuItem,

      url: "https://oapi.dingtalk.com/robot/send?access_token=YOUR_ACCESS_TOKEN",  DropdownMenuLabel,

      token: "YOUR_TOKEN",  DropdownMenuSeparator,

    },  DropdownMenuTrigger,

    enabled: true,} from "@/components/ui/dropdown-menu"

  },import { Checkbox } from "@/components/ui/checkbox"

];import { Separator } from "@/components/ui/separator"



// 数据警报组件import { EnhancedCard } from "../design-system/enhanced-card-system"

export default function DataAlert() {import { EnhancedButton } from "../design-system/enhanced-button-system"

  const [alerts, setAlerts] = useState<AlertConfig[]>(alertConfigs);import { AnimatedContainer } from "../design-system/animation-system"

  const [isConfiguring, setIsConfiguring] = useState(false);import { useSound } from "../design-system/sound-system"



  return (// 数据类型定义

    <div className="p-6 space-y-6">interface AlertCondition {

      <div className="flex items-center justify-between">  id: string

        <div>  field: string

          <h1 className="text-3xl font-bold">数据警报中心</h1>  operator: ">" | "<" | ">=" | "<=" | "=" | "!=" | "contains" | "not_contains" | "in" | "not_in"

          <p className="text-muted-foreground">  value: string | number

            监控系统数据异常，及时发送警报通知  dataType: "number" | "string" | "boolean" | "date"

          </p>}

        </div>

        <Buttoninterface AlertRule {

          onClick={() => setIsConfiguring(!isConfiguring)}  id: string

          variant="outline"  name: string

        >  description: string

          <Settings className="w-4 h-4 mr-2" />  enabled: boolean

          配置管理  priority: "low" | "medium" | "high" | "critical"

        </Button>  conditions: AlertCondition[]

      </div>  logicOperator: "AND" | "OR"

  notifications: NotificationChannel[]

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">  suppressionDuration: number // 分钟

        {alerts.map((alert) => (  maxAlerts: number

          <Card key={alert.id} className="relative">  escalationEnabled: boolean

            <CardHeader>  escalationDelay: number // 分钟

              <div className="flex items-center justify-between">  escalationChannels: NotificationChannel[]

                <CardTitle className="text-lg">{alert.name}</CardTitle>  createdAt: string

                <Badge variant={alert.enabled ? "default" : "secondary"}>  updatedAt: string

                  {alert.enabled ? "启用" : "禁用"}  createdBy: string

                </Badge>  lastTriggered?: string

              </div>  triggerCount: number

              <CardDescription>  status: "active" | "suppressed" | "disabled"

                类型: {alert.type.toUpperCase()}  tags: string[]

              </CardDescription>}

            </CardHeader>

            <CardContent>interface NotificationChannel {

              <div className="space-y-3">  id: string

                <div className="text-sm text-muted-foreground">  type: "email" | "sms" | "webhook" | "slack" | "teams" | "dingtalk"

                  配置状态: {alert.enabled ? "正常" : "未激活"}  name: string

                </div>  config: {

                <div className="flex items-center gap-2">    recipients?: string[]

                  {alert.enabled ? (    url?: string

                    <CheckCircle className="w-4 h-4 text-green-500" />    token?: string

                  ) : (    template?: string

                    <XCircle className="w-4 h-4 text-gray-400" />  }

                  )}  enabled: boolean

                  <span className="text-sm">}

                    {alert.enabled ? "运行中" : "已停用"}

                  </span>interface AlertHistory {

                </div>  id: string

              </div>  ruleId: string

            </CardContent>  ruleName: string

          </Card>  triggeredAt: string

        ))}  resolvedAt?: string

      </div>  severity: "low" | "medium" | "high" | "critical"

  message: string

      {isConfiguring && (  data: Record<string, any>

        <Card>  notificationsSent: number

          <CardHeader>  status: "triggered" | "resolved" | "suppressed"

            <CardTitle>警报配置</CardTitle>}

            <CardDescription>

              配置各种警报通知方式interface DataSource {

            </CardDescription>  id: string

          </CardHeader>  name: string

          <CardContent>  type: string

            <div className="text-sm text-muted-foreground">  fields: Array<{

              <p>⚠️ 注意：配置警报时请确保：</p>    name: string

              <ul className="list-disc list-inside mt-2 space-y-1">    type: "number" | "string" | "boolean" | "date"

                <li>使用有效的邮箱地址和手机号码</li>    description: string

                <li>Webhook URL 必须是可访问的 HTTPS 地址</li>  }>

                <li>钉钉机器人需要正确的 access_token</li>}

                <li>不要在代码中硬编码敏感信息</li>

              </ul>// 模拟数据

            </div>const mockDataSources: DataSource[] = [

          </CardContent>  {

        </Card>    id: "users",

      )}    name: "用户数据",

    </div>    type: "database",

  );    fields: [

}      { name: "total_users", type: "number", description: "总用户数" },
      { name: "active_users", type: "number", description: "活跃用户数" },
      { name: "new_registrations", type: "number", description: "新注册用户数" },
      { name: "user_retention_rate", type: "number", description: "用户留存率" },
    ],
  },
  {
    id: "sales",
    name: "销售数据",
    type: "database",
    fields: [
      { name: "daily_revenue", type: "number", description: "日营收" },
      { name: "order_count", type: "number", description: "订单数量" },
      { name: "conversion_rate", type: "number", description: "转化率" },
      { name: "average_order_value", type: "number", description: "平均订单价值" },
    ],
  },
  {
    id: "system",
    name: "系统指标",
    type: "monitoring",
    fields: [
      { name: "cpu_usage", type: "number", description: "CPU使用率" },
      { name: "memory_usage", type: "number", description: "内存使用率" },
      { name: "disk_usage", type: "number", description: "磁盘使用率" },
      { name: "response_time", type: "number", description: "响应时间" },
      { name: "error_rate", type: "number", description: "错误率" },
    ],
  },
]

const mockNotificationChannels: NotificationChannel[] = [
  {
    id: "email-admin",
    type: "email",
    name: "管理员邮件",
    config: {
      recipients: ["admin@yanyu.cloud", "ops@yanyu.cloud"],
      template: "default",
    },
    enabled: true,
  },
  {
    id: "sms-emergency",
    type: "sms",
    name: "紧急短信",
    config: {
      recipients: ["+86138****8888", "+86139****9999"],
    },
    enabled: true,
  },
  {
    id: "webhook-slack",
    type: "webhook",
    name: "Slack通知",
    config: {
      url: "https://hooks.slack.com/services/YOUR_WORKSPACE/YOUR_CHANNEL/YOUR_WEBHOOK_TOKEN",
      template: "slack",
    },
    enabled: true,
  },
  {
    id: "dingtalk-ops",
    type: "dingtalk",
    name: "钉钉运维群",
    config: {
      url: "https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxx",
      token: "xxxxxxxx",
    },
    enabled: true,
  },
]

const mockAlertRules: AlertRule[] = [
  {
    id: "rule-1",
    name: "CPU使用率过高告警",
    description: "当CPU使用率超过80%时触发告警",
    enabled: true,
    priority: "high",
    conditions: [
      {
        id: "cond-1",
        field: "cpu_usage",
        operator: ">",
        value: 80,
        dataType: "number",
      },
    ],
    logicOperator: "AND",
    notifications: [mockNotificationChannels[0], mockNotificationChannels[2]],
    suppressionDuration: 15,
    maxAlerts: 5,
    escalationEnabled: true,
    escalationDelay: 30,
    escalationChannels: [mockNotificationChannels[1]],
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-20T14:30:00Z",
    createdBy: "admin@yanyu.cloud",
    lastTriggered: "2024-01-20T15:45:00Z",
    triggerCount: 12,
    status: "active",
    tags: ["系统监控", "性能"],
  },
  {
    id: "rule-2",
    name: "用户注册异常告警",
    description: "当新注册用户数异常下降时触发告警",
    enabled: true,
    priority: "medium",
    conditions: [
      {
        id: "cond-2",
        field: "new_registrations",
        operator: "<",
        value: 10,
        dataType: "number",
      },
    ],
    logicOperator: "AND",
    notifications: [mockNotificationChannels[0]],
    suppressionDuration: 60,
    maxAlerts: 3,
    escalationEnabled: false,
    escalationDelay: 0,
    escalationChannels: [],
    createdAt: "2024-01-10T09:00:00Z",
    updatedAt: "2024-01-18T11:20:00Z",
    createdBy: "product@yanyu.cloud",
    triggerCount: 3,
    status: "active",
    tags: ["用户增长", "业务监控"],
  },
  {
    id: "rule-3",
    name: "营收下降告警",
    description: "当日营收低于预期阈值时触发告警",
    enabled: false,
    priority: "critical",
    conditions: [
      {
        id: "cond-3",
        field: "daily_revenue",
        operator: "<",
        value: 50000,
        dataType: "number",
      },
      {
        id: "cond-4",
        field: "conversion_rate",
        operator: "<",
        value: 2.5,
        dataType: "number",
      },
    ],
    logicOperator: "OR",
    notifications: [mockNotificationChannels[0], mockNotificationChannels[1]],
    suppressionDuration: 30,
    maxAlerts: 10,
    escalationEnabled: true,
    escalationDelay: 15,
    escalationChannels: [mockNotificationChannels[1]],
    createdAt: "2024-01-12T14:00:00Z",
    updatedAt: "2024-01-19T16:45:00Z",
    createdBy: "finance@yanyu.cloud",
    triggerCount: 0,
    status: "disabled",
    tags: ["财务监控", "营收"],
  },
]

const mockAlertHistory: AlertHistory[] = [
  {
    id: "alert-1",
    ruleId: "rule-1",
    ruleName: "CPU使用率过高告警",
    triggeredAt: "2024-01-20T15:45:00Z",
    resolvedAt: "2024-01-20T16:15:00Z",
    severity: "high",
    message: "CPU使用率达到85%，超过阈值80%",
    data: { cpu_usage: 85, timestamp: "2024-01-20T15:45:00Z" },
    notificationsSent: 2,
    status: "resolved",
  },
  {
    id: "alert-2",
    ruleId: "rule-2",
    ruleName: "用户注册异常告警",
    triggeredAt: "2024-01-20T09:30:00Z",
    severity: "medium",
    message: "新注册用户数仅为8人，低于阈值10人",
    data: { new_registrations: 8, timestamp: "2024-01-20T09:30:00Z" },
    notificationsSent: 1,
    status: "triggered",
  },
  {
    id: "alert-3",
    ruleId: "rule-1",
    ruleName: "CPU使用率过高告警",
    triggeredAt: "2024-01-19T22:15:00Z",
    resolvedAt: "2024-01-19T22:45:00Z",
    severity: "high",
    message: "CPU使用率达到88%，超过阈值80%",
    data: { cpu_usage: 88, timestamp: "2024-01-19T22:15:00Z" },
    notificationsSent: 3,
    status: "resolved",
  },
]

export function DataAlert() {
  const [activeTab, setActiveTab] = useState("rules")
  const [alertRules, setAlertRules] = useState<AlertRule[]>(mockAlertRules)
  const [alertHistory, setAlertHistory] = useState<AlertHistory[]>(mockAlertHistory)
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>(mockNotificationChannels)
  const [dataSources] = useState<DataSource[]>(mockDataSources)

  const [selectedRule, setSelectedRule] = useState<AlertRule | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterPriority, setFilterPriority] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const { playSound } = useSound()

  // 新建告警规则的表单状态
  const [newRule, setNewRule] = useState<Partial<AlertRule>>({
    name: "",
    description: "",
    enabled: true,
    priority: "medium",
    conditions: [],
    logicOperator: "AND",
    notifications: [],
    suppressionDuration: 15,
    maxAlerts: 5,
    escalationEnabled: false,
    escalationDelay: 30,
    escalationChannels: [],
    tags: [],
  })

  // 条件编辑状态
  const [editingCondition, setEditingCondition] = useState<AlertCondition | null>(null)

  const handleCreateRule = useCallback(() => {
    if (!newRule.name || !newRule.description || !newRule.conditions?.length) {
      playSound("error")
      return
    }

    const rule: AlertRule = {
      id: `rule-${Date.now()}`,
      name: newRule.name,
      description: newRule.description,
      enabled: newRule.enabled ?? true,
      priority: newRule.priority ?? "medium",
      conditions: newRule.conditions ?? [],
      logicOperator: newRule.logicOperator ?? "AND",
      notifications: newRule.notifications ?? [],
      suppressionDuration: newRule.suppressionDuration ?? 15,
      maxAlerts: newRule.maxAlerts ?? 5,
      escalationEnabled: newRule.escalationEnabled ?? false,
      escalationDelay: newRule.escalationDelay ?? 30,
      escalationChannels: newRule.escalationChannels ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "current-user@yanyu.cloud",
      triggerCount: 0,
      status: "active",
      tags: newRule.tags ?? [],
    }

    setAlertRules((prev) => [...prev, rule])
    setIsCreateDialogOpen(false)
    setNewRule({
      name: "",
      description: "",
      enabled: true,
      priority: "medium",
      conditions: [],
      logicOperator: "AND",
      notifications: [],
      suppressionDuration: 15,
      maxAlerts: 5,
      escalationEnabled: false,
      escalationDelay: 30,
      escalationChannels: [],
      tags: [],
    })
    playSound("success")
  }, [newRule, playSound])

  const handleUpdateRule = useCallback(
    (updatedRule: AlertRule) => {
      setAlertRules((prev) =>
        prev.map((rule) =>
          rule.id === updatedRule.id ? { ...updatedRule, updatedAt: new Date().toISOString() } : rule,
        ),
      )
      setIsEditDialogOpen(false)
      setSelectedRule(null)
      playSound("success")
    },
    [playSound],
  )

  const handleDeleteRule = useCallback(
    (ruleId: string) => {
      setAlertRules((prev) => prev.filter((rule) => rule.id !== ruleId))
      playSound("success")
    },
    [playSound],
  )

  const handleToggleRule = useCallback(
    (ruleId: string) => {
      setAlertRules((prev) =>
        prev.map((rule) =>
          rule.id === ruleId
            ? {
                ...rule,
                enabled: !rule.enabled,
                status: !rule.enabled ? "active" : "disabled",
                updatedAt: new Date().toISOString(),
              }
            : rule,
        ),
      )
      playSound("click")
    },
    [playSound],
  )

  const addCondition = useCallback(() => {
    const newCondition: AlertCondition = {
      id: `cond-${Date.now()}`,
      field: "",
      operator: ">",
      value: "",
      dataType: "number",
    }
    setNewRule((prev) => ({
      ...prev,
      conditions: [...(prev.conditions || []), newCondition],
    }))
  }, [])

  const updateCondition = useCallback((conditionId: string, updates: Partial<AlertCondition>) => {
    setNewRule((prev) => ({
      ...prev,
      conditions: prev.conditions?.map((cond) => (cond.id === conditionId ? { ...cond, ...updates } : cond)),
    }))
  }, [])

  const removeCondition = useCallback((conditionId: string) => {
    setNewRule((prev) => ({
      ...prev,
      conditions: prev.conditions?.filter((cond) => cond.id !== conditionId),
    }))
  }, [])

  const getFieldOptions = useCallback(
    (dataSourceId?: string) => {
      if (!dataSourceId) return []
      const source = dataSources.find((ds) => ds.id === dataSourceId)
      return source?.fields || []
    },
    [dataSources],
  )

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200"
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "suppressed":
        return "bg-yellow-100 text-yellow-800"
      case "disabled":
        return "bg-gray-100 text-gray-800"
      case "triggered":
        return "bg-red-100 text-red-800"
      case "resolved":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="w-4 h-4" />
      case "sms":
        return <Smartphone className="w-4 h-4" />
      case "webhook":
        return <Webhook className="w-4 h-4" />
      case "slack":
        return <MessageSquare className="w-4 h-4" />
      case "dingtalk":
        return <MessageSquare className="w-4 h-4" />
      default:
        return <Bell className="w-4 h-4" />
    }
  }

  const filteredRules = alertRules.filter((rule) => {
    const matchesSearch =
      rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPriority = filterPriority === "all" || rule.priority === filterPriority
    const matchesStatus = filterStatus === "all" || rule.status === filterStatus

    return matchesSearch && matchesPriority && matchesStatus
  })

  const activeRulesCount = alertRules.filter((rule) => rule.enabled).length
  const triggeredAlertsCount = alertHistory.filter((alert) => alert.status === "triggered").length
  const totalNotificationsSent = alertHistory.reduce((sum, alert) => sum + alert.notificationsSent, 0)

  return (
    <div className="space-y-6">
      {/* 数据预警概览 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AnimatedContainer animation="slideUp" delay={0}>
          <EnhancedCard variant="glass" interactive>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活跃规则</CardTitle>
              <Shield className="h-4 w-4 text-traditional-jade" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-traditional-jade">{activeRulesCount}</div>
              <p className="text-xs text-secondary-500">共 {alertRules.length} 条规则</p>
            </CardContent>
          </EnhancedCard>
        </AnimatedContainer>

        <AnimatedContainer animation="slideUp" delay={150}>
          <EnhancedCard variant="glass" interactive>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待处理告警</CardTitle>
              <AlertTriangle className="h-4 w-4 text-traditional-crimson" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-traditional-crimson">{triggeredAlertsCount}</div>
              <p className="text-xs text-secondary-500">需要关注处理</p>
            </CardContent>
          </EnhancedCard>
        </AnimatedContainer>

        <AnimatedContainer animation="slideUp" delay={300}>
          <EnhancedCard variant="glass" interactive>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">通知发送</CardTitle>
              <Bell className="h-4 w-4 text-primary-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary-500">{totalNotificationsSent}</div>
              <p className="text-xs text-secondary-500">今日发送次数</p>
            </CardContent>
          </EnhancedCard>
        </AnimatedContainer>

        <AnimatedContainer animation="slideUp" delay={450}>
          <EnhancedCard variant="glass" interactive>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">响应时间</CardTitle>
              <Clock className="h-4 w-4 text-accent-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent-500">2.3s</div>
              <p className="text-xs text-secondary-500">平均告警响应时间</p>
            </CardContent>
          </EnhancedCard>
        </AnimatedContainer>
      </div>

      {/* 主要功能区域 */}
      <EnhancedCard variant="traditional" size="lg">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="rules">告警规则</TabsTrigger>
            <TabsTrigger value="history">告警历史</TabsTrigger>
            <TabsTrigger value="channels">通知渠道</TabsTrigger>
            <TabsTrigger value="analytics">分析报告</TabsTrigger>
          </TabsList>

          {/* 告警规则管理 */}
          <TabsContent value="rules" className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold">告警规则管理</h3>
                <p className="text-sm text-secondary-600">配置和管理数据预警规则</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2">
                  <Search className="w-4 h-4 text-secondary-500" />
                  <Input
                    placeholder="搜索规则..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-48"
                  />
                </div>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部优先级</SelectItem>
                    <SelectItem value="critical">紧急</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="active">活跃</SelectItem>
                    <SelectItem value="disabled">禁用</SelectItem>
                    <SelectItem value="suppressed">抑制</SelectItem>
                  </SelectContent>
                </Select>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <EnhancedButton variant="primary" glowEffect>
                      <Plus className="w-4 h-4 mr-2" />
                      新建规则
                    </EnhancedButton>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>创建告警规则</DialogTitle>
                      <DialogDescription>配置数据预警规则，支持多维度条件组合和灵活的通知策略</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                      {/* 基本信息 */}
                      <div className="space-y-4">
                        <h4 className="font-medium">基本信息</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="rule-name">规则名称 *</Label>
                            <Input
                              id="rule-name"
                              value={newRule.name || ""}
                              onChange={(e) => setNewRule((prev) => ({ ...prev, name: e.target.value }))}
                              placeholder="输入规则名称"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="rule-priority">优先级</Label>
                            <Select
                              value={newRule.priority}
                              onValueChange={(value) => setNewRule((prev) => ({ ...prev, priority: value as any }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">低</SelectItem>
                                <SelectItem value="medium">中</SelectItem>
                                <SelectItem value="high">高</SelectItem>
                                <SelectItem value="critical">紧急</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rule-description">描述</Label>
                          <Textarea
                            id="rule-description"
                            value={newRule.description || ""}
                            onChange={(e) => setNewRule((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="描述告警规则的用途和触发条件"
                            rows={3}
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newRule.enabled}
                            onCheckedChange={(checked) => setNewRule((prev) => ({ ...prev, enabled: checked }))}
                          />
                          <Label>启用规则</Label>
                        </div>
                      </div>

                      <Separator />

                      {/* 触发条件 */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">触发条件</h4>
                          <div className="flex items-center space-x-2">
                            <Label>逻辑关系:</Label>
                            <Select
                              value={newRule.logicOperator}
                              onValueChange={(value) =>
                                setNewRule((prev) => ({ ...prev, logicOperator: value as "AND" | "OR" }))
                              }
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AND">AND</SelectItem>
                                <SelectItem value="OR">OR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {newRule.conditions?.map((condition, index) => (
                            <div key={condition.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                              <span className="text-sm text-secondary-500 w-8">{index + 1}.</span>

                              <Select
                                value={condition.field}
                                onValueChange={(value) => {
                                  const field = dataSources.flatMap((ds) => ds.fields).find((f) => f.name === value)
                                  updateCondition(condition.id, {
                                    field: value,
                                    dataType: field?.type || "number",
                                  })
                                }}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue placeholder="选择字段" />
                                </SelectTrigger>
                                <SelectContent>
                                  {dataSources.map((ds) => (
                                    <div key={ds.id}>
                                      <DropdownMenuLabel>{ds.name}</DropdownMenuLabel>
                                      {ds.fields.map((field) => (
                                        <SelectItem key={field.name} value={field.name}>
                                          {field.description} ({field.name})
                                        </SelectItem>
                                      ))}
                                      <DropdownMenuSeparator />
                                    </div>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                value={condition.operator}
                                onValueChange={(value) => updateCondition(condition.id, { operator: value as any })}
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value=">">大于</SelectItem>
                                  <SelectItem value="<">小于</SelectItem>
                                  <SelectItem value=">=">大于等于</SelectItem>
                                  <SelectItem value="<=">小于等于</SelectItem>
                                  <SelectItem value="=">等于</SelectItem>
                                  <SelectItem value="!=">不等于</SelectItem>
                                  {condition.dataType === "string" && (
                                    <>
                                      <SelectItem value="contains">包含</SelectItem>
                                      <SelectItem value="not_contains">不包含</SelectItem>
                                    </>
                                  )}
                                </SelectContent>
                              </Select>

                              <Input
                                value={condition.value}
                                onChange={(e) =>
                                  updateCondition(condition.id, {
                                    value: condition.dataType === "number" ? Number(e.target.value) : e.target.value,
                                  })
                                }
                                placeholder="阈值"
                                type={condition.dataType === "number" ? "number" : "text"}
                                className="w-32"
                              />

                              <Button variant="ghost" size="sm" onClick={() => removeCondition(condition.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <Button variant="outline" onClick={addCondition}>
                          <Plus className="w-4 h-4 mr-2" />
                          添加条件
                        </Button>
                      </div>

                      <Separator />

                      {/* 通知设置 */}
                      <div className="space-y-4">
                        <h4 className="font-medium">通知设置</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>通知渠道</Label>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                              {notificationChannels.map((channel) => (
                                <div key={channel.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    checked={newRule.notifications?.some((n) => n.id === channel.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setNewRule((prev) => ({
                                          ...prev,
                                          notifications: [...(prev.notifications || []), channel],
                                        }))
                                      } else {
                                        setNewRule((prev) => ({
                                          ...prev,
                                          notifications: prev.notifications?.filter((n) => n.id !== channel.id),
                                        }))
                                      }
                                    }}
                                  />
                                  <div className="flex items-center space-x-2">
                                    {getNotificationIcon(channel.type)}
                                    <span className="text-sm">{channel.name}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>抑制时长 (分钟)</Label>
                              <div className="space-y-2">
                                <Slider
                                  value={[newRule.suppressionDuration || 15]}
                                  onValueChange={([value]) =>
                                    setNewRule((prev) => ({ ...prev, suppressionDuration: value }))
                                  }
                                  max={120}
                                  min={1}
                                  step={1}
                                />
                                <div className="text-sm text-secondary-500">
                                  {newRule.suppressionDuration} 分钟内不重复发送
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>最大告警数</Label>
                              <Input
                                type="number"
                                value={newRule.maxAlerts}
                                onChange={(e) => setNewRule((prev) => ({ ...prev, maxAlerts: Number(e.target.value) }))}
                                min={1}
                                max={100}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* 升级机制 */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newRule.escalationEnabled}
                            onCheckedChange={(checked) =>
                              setNewRule((prev) => ({ ...prev, escalationEnabled: checked }))
                            }
                          />
                          <Label>启用升级机制</Label>
                        </div>

                        {newRule.escalationEnabled && (
                          <div className="grid grid-cols-2 gap-4 pl-6">
                            <div className="space-y-2">
                              <Label>升级延迟 (分钟)</Label>
                              <Input
                                type="number"
                                value={newRule.escalationDelay}
                                onChange={(e) =>
                                  setNewRule((prev) => ({ ...prev, escalationDelay: Number(e.target.value) }))
                                }
                                min={1}
                                max={1440}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>升级通知渠道</Label>
                              <div className="space-y-2 max-h-24 overflow-y-auto">
                                {notificationChannels.map((channel) => (
                                  <div key={channel.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={newRule.escalationChannels?.some((n) => n.id === channel.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setNewRule((prev) => ({
                                            ...prev,
                                            escalationChannels: [...(prev.escalationChannels || []), channel],
                                          }))
                                        } else {
                                          setNewRule((prev) => ({
                                            ...prev,
                                            escalationChannels: prev.escalationChannels?.filter(
                                              (n) => n.id !== channel.id,
                                            ),
                                          }))
                                        }
                                      }}
                                    />
                                    <div className="flex items-center space-x-2">
                                      {getNotificationIcon(channel.type)}
                                      <span className="text-sm">{channel.name}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                        取消
                      </Button>
                      <EnhancedButton variant="primary" onClick={handleCreateRule}>
                        <Save className="w-4 h-4 mr-2" />
                        创建规则
                      </EnhancedButton>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="space-y-4">
              {filteredRules.map((rule, index) => (
                <AnimatedContainer key={rule.id} animation="slideRight" delay={index * 100}>
                  <EnhancedCard variant="glass" className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-medium text-lg">{rule.name}</h4>
                          <Badge variant="outline" className={getPriorityColor(rule.priority)}>
                            {rule.priority === "critical"
                              ? "紧急"
                              : rule.priority === "high"
                                ? "高"
                                : rule.priority === "medium"
                                  ? "中"
                                  : "低"}
                          </Badge>
                          <Badge variant="outline" className={getStatusColor(rule.status)}>
                            {rule.status === "active" ? "活跃" : rule.status === "suppressed" ? "抑制" : "禁用"}
                          </Badge>
                          {rule.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-secondary-600 mb-3">{rule.description}</p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-secondary-500">触发条件:</span>
                            <div className="mt-1">
                              {rule.conditions.map((condition, idx) => (
                                <div key={condition.id} className="text-xs">
                                  {idx > 0 && <span className="text-secondary-400 mr-1">{rule.logicOperator}</span>}
                                  <span className="font-mono">
                                    {condition.field} {condition.operator} {condition.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-secondary-500">通知渠道:</span>
                            <div className="flex items-center space-x-1 mt-1">
                              {rule.notifications.slice(0, 3).map((channel) => (
                                <div key={channel.id} className="flex items-center space-x-1">
                                  {getNotificationIcon(channel.type)}
                                </div>
                              ))}
                              {rule.notifications.length > 3 && (
                                <span className="text-xs text-secondary-500">+{rule.notifications.length - 3}</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-secondary-500">统计信息:</span>
                            <div className="mt-1 text-xs">
                              <div>触发次数: {rule.triggerCount}</div>
                              {rule.lastTriggered && (
                                <div>最后触发: {new Date(rule.lastTriggered).toLocaleString()}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <Switch checked={rule.enabled} onCheckedChange={() => handleToggleRule(rule.id)} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedRule(rule)
                                setIsEditDialogOpen(true)
                              }}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              编辑规则
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="w-4 h-4 mr-2" />
                              复制规则
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Play className="w-4 h-4 mr-2" />
                              测试规则
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteRule(rule.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              删除规则
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </EnhancedCard>
                </AnimatedContainer>
              ))}
            </div>
          </TabsContent>

          {/* 告警历史 */}
          <TabsContent value="history" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">告警历史</h3>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  筛选
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  导出
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {alertHistory.map((alert, index) => (
                <AnimatedContainer key={alert.id} animation="slideUp" delay={index * 50}>
                  <EnhancedCard variant="glass" className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-medium">{alert.ruleName}</h4>
                          <Badge variant="outline" className={getPriorityColor(alert.severity)}>
                            {alert.severity === "critical"
                              ? "紧急"
                              : alert.severity === "high"
                                ? "高"
                                : alert.severity === "medium"
                                  ? "中"
                                  : "低"}
                          </Badge>
                          <Badge variant="outline" className={getStatusColor(alert.status)}>
                            {alert.status === "triggered"
                              ? "已触发"
                              : alert.status === "resolved"
                                ? "已解决"
                                : "抑制中"}
                          </Badge>
                        </div>
                        <p className="text-secondary-600 mb-2">{alert.message}</p>
                        <div className="flex items-center space-x-4 text-sm text-secondary-500">
                          <span>触发时间: {new Date(alert.triggeredAt).toLocaleString()}</span>
                          {alert.resolvedAt && <span>解决时间: {new Date(alert.resolvedAt).toLocaleString()}</span>}
                          <span>通知发送: {alert.notificationsSent} 次</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {alert.status === "triggered" ? (
                          <XCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                    </div>
                  </EnhancedCard>
                </AnimatedContainer>
              ))}
            </div>
          </TabsContent>

          {/* 通知渠道 */}
          <TabsContent value="channels" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">通知渠道管理</h3>
              <EnhancedButton variant="primary">
                <Plus className="w-4 h-4 mr-2" />
                添加渠道
              </EnhancedButton>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {notificationChannels.map((channel, index) => (
                <AnimatedContainer key={channel.id} animation="slideLeft" delay={index * 100}>
                  <EnhancedCard variant="glass" className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        {getNotificationIcon(channel.type)}
                        <div>
                          <h4 className="font-medium">{channel.name}</h4>
                          <p className="text-sm text-secondary-500 capitalize">{channel.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch checked={channel.enabled} />
                        <Button variant="ghost" size="sm">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-secondary-600">
                      {channel.type === "email" && <div>收件人: {channel.config.recipients?.join(", ")}</div>}
                      {channel.type === "sms" && <div>手机号: {channel.config.recipients?.join(", ")}</div>}
                      {channel.type === "webhook" && <div>URL: {channel.config.url}</div>}
                    </div>
                  </EnhancedCard>
                </AnimatedContainer>
              ))}
            </div>
          </TabsContent>

          {/* 分析报告 */}
          <TabsContent value="analytics" className="space-y-4">
            <h3 className="text-lg font-semibold">告警分析报告</h3>

            <div className="grid gap-6 md:grid-cols-2">
              <EnhancedCard variant="glass" className="p-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5" />
                    <span>告警趋势分析</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>今日告警</span>
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="font-medium">12</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>昨日告警</span>
                      <span className="font-medium">8</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>本周平均</span>
                      <span className="font-medium">9.5</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>解决率</span>
                      <span className="font-medium text-green-600">87.5%</span>
                    </div>
                  </div>
                </CardContent>
              </EnhancedCard>

              <EnhancedCard variant="glass" className="p-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="w-5 h-5" />
                    <span>热点告警规则</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {alertRules
                      .sort((a, b) => b.triggerCount - a.triggerCount)
                      .slice(0, 5)
                      .map((rule) => (
                        <div key={rule.id} className="flex justify-between items-center">
                          <span className="text-sm truncate">{rule.name}</span>
                          <Badge variant="secondary">{rule.triggerCount}</Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </EnhancedCard>

              <EnhancedCard variant="glass" className="p-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="w-5 h-5" />
                    <span>响应时间分析</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>平均响应时间</span>
                      <span className="font-medium">2.3秒</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>最快响应</span>
                      <span className="font-medium text-green-600">0.8秒</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>最慢响应</span>
                      <span className="font-medium text-red-600">8.5秒</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>响应时间分布</span>
                        <span>95% &lt; 5秒</span>
                      </div>
                      <Progress value={95} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </EnhancedCard>

              <EnhancedCard variant="glass" className="p-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center space-x-2">
                    <Bell className="w-5 h-5" />
                    <span>通知效果分析</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>邮件通知</span>
                      <div className="flex items-center space-x-2">
                        <Progress value={92} className="w-16 h-2" />
                        <span className="text-sm">92%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>短信通知</span>
                      <div className="flex items-center space-x-2">
                        <Progress value={98} className="w-16 h-2" />
                        <span className="text-sm">98%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Webhook</span>
                      <div className="flex items-center space-x-2">
                        <Progress value={89} className="w-16 h-2" />
                        <span className="text-sm">89%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>钉钉通知</span>
                      <div className="flex items-center space-x-2">
                        <Progress value={95} className="w-16 h-2" />
                        <span className="text-sm">95%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </EnhancedCard>
            </div>
          </TabsContent>
        </Tabs>
      </EnhancedCard>
    </div>
  )
}

export default DataAlert
