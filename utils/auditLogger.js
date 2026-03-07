const AuditLog = require('../models/AuditLog');

//Logs actions to audit log without breaking main if fails

async function logAudit(userId, workspaceId, entityType, entityId, action, details = {}){
    try{
        await AuditLog.create({
            user_id: userId,
            workspace_id: workspaceId,
            entity_type: entityType,
            entity_id: entityId,
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