import { prisma } from '@/lib/prisma';

export async function logParse({
  entryId,
  strategy,
  inputSize,
  outputSize,
  processingTime,
  success,
  error,
}: {
  entryId: string;
  strategy: string;
  inputSize: number;
  outputSize: number;
  processingTime: number;
  success: boolean;
  error?: string;
}) {
  try {
    await prisma.parseLog.create({
      data: {
        entryId,
        strategy,
        inputSize,
        outputSize,
        processingTime,
        success,
        error,
      },
    });
  } catch (err) {
    console.error('Failed to log parse:', err);
  }
}
