

require('dotenv').config();
const mongoose = require('mongoose');
const Workspace = require('./models/Workspace');
const WorkspaceMember = require('./models/WSmem');

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const workspaces = await Workspace.find({});
    console.log(`Found ${workspaces.length} workspaces`);

    let created = 0;
    let skipped = 0;

    for (const ws of workspaces) {
        const existing = await WorkspaceMember.findOne({
            workspace_id: ws._id.toString(),
            user_id: ws.owner.toString()
        });

        if (existing) {
            console.log(`  SKIP  ${ws._id} — membership already exists`);
            skipped++;
            continue;
        }

        await WorkspaceMember.create({
            workspace_id: ws._id.toString(),
            user_id:      ws.owner.toString(),
            role:         'owner',
            joined_at:    ws.createdAt
        });

        console.log(`  CREATED  ${ws._id} (${ws.name}) — owner: ${ws.owner}`);
        created++;
    }

    console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
    await mongoose.disconnect();
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});