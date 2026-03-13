const { PrismaClient } = require('@prisma/client');
const { Inngest } = require('inngest');

const prisma = new PrismaClient();
const inngest = new Inngest({ id: 'ai-practice', eventKey: process.env.INNGEST_EVENT_KEY });

async function triggerComparison() {
  const entryId = 'cmmh14ab0000085b5xo7icczo';
  const targetMode = 'two-step';

  // Create batch
  const batch = await prisma.comparisonBatch.create({
    data: {
      targetMode,
      entryCount: 1,
      status: 'pending',
      progress: 0,
    },
  });

  console.log('Created batch:', batch.id);

  // Send event
  await inngest.send({
    name: 'comparison/process-batch',
    data: {
      batchId: batch.id,
      entryIds: [entryId],
      targetMode,
    },
  });

  console.log('Event sent successfully');
  console.log('Batch ID:', batch.id);

  await prisma.$disconnect();
}

triggerComparison().catch(console.error);
