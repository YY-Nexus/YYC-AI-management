"use strict";
// 修复validation.middleware.ts文件中的TypeScript错误，统一使用CommonJS格式
const express = require('express');
const Joi = require('joi');
const { logger } = require('../config/logger');
// 定义validateRequest中间件
const validateRequest = (schema, source = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[source] || {}, {
            abortEarly: false,
            stripUnknown: true,
        });
        if (error) {
            const errors = error.details.map((detail) => ({
                field: detail.path.join('.'),
                message: detail.message,
            }));
            logger.warn('Validation error', {
                path: req.path,
                errors,
            });
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors,
            });
        }
        // 正确地将验证后的数据附加到请求对象
        if (source === 'body' && req.body) {
            req.body = value;
        }
        else if (source === 'query' && req.query) {
            req.query = value;
        }
        else if (source === 'params' && req.params) {
            req.params = value;
        }
        next();
    };
};
// 使用CommonJS导出
module.exports = {
    validateRequest
};
