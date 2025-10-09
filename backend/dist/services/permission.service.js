"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionService = void 0;
class PermissionService {
    // 权限检查函数，支持资源级别权限检查
    static async checkPermission(userId, action, resource, resourceId) {
        // 获取用户角色
        const userRoles = await this.getUserRoles(userId);
        // 获取角色权限
        const permissions = await this.getRolePermissions(userRoles);
        // 检查权限
        return permissions.some((permission) => {
            // 检查操作权限
            if (permission.action !== action && permission.action !== "*") {
                return false;
            }
            // 检查资源权限
            if (permission.resource !== resource && permission.resource !== "*") {
                return false;
            }
            // 检查资源ID权限（如果提供）
            if (resourceId &&
                permission.resourceId &&
                permission.resourceId !== resourceId &&
                permission.resourceId !== "*") {
                return false;
            }
            return true;
        });
    }
    // 获取用户角色
    static async getUserRoles(userId) {
        // 模拟从数据库获取用户角色
        // 在实际应用中，这里需要连接数据库
        const mockUserRoles = {
            admin: ["admin", "user"],
            user: ["user"],
            manager: ["manager", "user"],
        };
        return mockUserRoles[userId] || ["user"];
    }
    // 获取角色权限
    static async getRolePermissions(roles) {
        // 模拟权限配置
        const rolePermissions = {
            admin: [{ action: "*", resource: "*", resourceId: "*" }],
            manager: [
                { action: "read", resource: "reconciliation", resourceId: "*" },
                { action: "write", resource: "reconciliation", resourceId: "*" },
                { action: "read", resource: "analytics", resourceId: "*" },
            ],
            user: [
                { action: "read", resource: "reconciliation", resourceId: "*" },
                { action: "read", resource: "dashboard", resourceId: "*" },
            ],
        };
        const permissions = [];
        roles.forEach((role) => {
            if (rolePermissions[role]) {
                permissions.push(...rolePermissions[role]);
            }
        });
        return permissions;
    }
}
exports.PermissionService = PermissionService;
