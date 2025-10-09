"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
const error_codes_1 = require("../constants/error-codes");
class AppError extends Error {
    constructor(message, statusCode = 500, errorCode = error_codes_1.ErrorCode.UNKNOWN_ERROR, details, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
    static badRequest(message, errorCode = error_codes_1.ErrorCode.BAD_REQUEST, details) {
        return new AppError(message, 400, errorCode, details);
    }
    static unauthorized(message = "Unauthorized", errorCode = error_codes_1.ErrorCode.UNAUTHORIZED, details) {
        return new AppError(message, 401, errorCode, details);
    }
    static forbidden(message = "Forbidden", errorCode = error_codes_1.ErrorCode.FORBIDDEN, details) {
        return new AppError(message, 403, errorCode, details);
    }
    static notFound(message = "Resource not found", errorCode = error_codes_1.ErrorCode.NOT_FOUND, details) {
        return new AppError(message, 404, errorCode, details);
    }
    static conflict(message, errorCode = error_codes_1.ErrorCode.CONFLICT, details) {
        return new AppError(message, 409, errorCode, details);
    }
    static validationError(message, details) {
        return new AppError(message, 422, error_codes_1.ErrorCode.VALIDATION_ERROR, details);
    }
    static internal(message = "Internal server error", errorCode = error_codes_1.ErrorCode.INTERNAL_ERROR, details) {
        return new AppError(message, 500, errorCode, details, true);
    }
}
exports.AppError = AppError;
