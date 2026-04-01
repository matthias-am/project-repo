const AuditLog = require('../models/AuditLog');

//Logs actions to audit log without breaking main if fails

async function logAudit(userId, workspaceId, entityType, entityId, action, details = {}){
    try{
        await AuditLog.create({
            userId,
            workspaceId,
            entityType,
            entityId,
            action,
            details,
            timestamp: new Date()
        });
     } catch (err) {
        console.error('Audit logging failed: ', err.message
        );
    }
}

module.exports = { logAudit};