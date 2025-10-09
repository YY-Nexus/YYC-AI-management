"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = validateRequest;
const logger_1 = require("../config/logger");
function validateRequest(schema, source = "body") {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[source], {
            abortEarly: false,
            stripUnknown: true,
        });
        if (error) {
            const errors = error.details.map((detail) => ({
                field: detail.path.join("."),
                message: detail.message,
            }));
            logger_1.logger.warn("Validation error", {
                path: req.path,
                errors,
            });
            return res.status(400).json({
                success: false,
                error: "Validation failed",
                details: errors,
            });
        }
        req[source] = value;
        next();
    };
}
