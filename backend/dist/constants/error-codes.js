"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCode = void 0;
var ErrorCode;
(function (ErrorCode) {
    // 1xxx: 认证与授权错误
    ErrorCode["UNAUTHORIZED"] = "ERR_1001";
    ErrorCode["INVALID_TOKEN"] = "ERR_1002";
    ErrorCode["TOKEN_EXPIRED"] = "ERR_1003";
    ErrorCode["FORBIDDEN"] = "ERR_1004";
    ErrorCode["INSUFFICIENT_PERMISSIONS"] = "ERR_1005";
    // 2xxx: 输入验证错误
    ErrorCode["BAD_REQUEST"] = "ERR_2001";
    ErrorCode["VALIDATION_ERROR"] = "ERR_2002";
    ErrorCode["INVALID_PARAMETER"] = "ERR_2003";
    ErrorCode["MISSING_PARAMETER"] = "ERR_2004";
    // 3xxx: 资源错误
    ErrorCode["NOT_FOUND"] = "ERR_3001";
    ErrorCode["CONFLICT"] = "ERR_3002";
    ErrorCode["RESOURCE_EXISTS"] = "ERR_3003";
    // 4xxx: 业务逻辑错误
    ErrorCode["BUSINESS_ERROR"] = "ERR_4001";
    ErrorCode["INVALID_OPERATION"] = "ERR_4002";
    ErrorCode["OPERATION_FAILED"] = "ERR_4003";
    // 5xxx: 系统错误
    ErrorCode["INTERNAL_ERROR"] = "ERR_5001";
    ErrorCode["DATABASE_ERROR"] = "ERR_5002";
    ErrorCode["EXTERNAL_SERVICE_ERROR"] = "ERR_5003";
    ErrorCode["CACHE_ERROR"] = "ERR_5004";
    // 6xxx: AI服务错误
    ErrorCode["AI_ANALYSIS_FAILED"] = "ERR_6001";
    ErrorCode["AI_REPLY_GENERATION_FAILED"] = "ERR_6002";
    ErrorCode["AI_SENTIMENT_ANALYSIS_FAILED"] = "ERR_6003";
    ErrorCode["AI_DATA_EXTRACTION_FAILED"] = "ERR_6004";
    ErrorCode["AI_SATISFACTION_PREDICTION_FAILED"] = "ERR_6005";
    ErrorCode["AI_BATCH_CLASSIFICATION_FAILED"] = "ERR_6006";
    // 9xxx: 未分类错误
    ErrorCode["UNKNOWN_ERROR"] = "ERR_9001";
    ErrorCode["NOT_IMPLEMENTED"] = "ERR_9002";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
