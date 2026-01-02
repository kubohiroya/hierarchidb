import type { ProcessingStage } from '../../../../common/types/index.js';

export type StageMessages = {
  taskQueuedMessage: string;
  alreadyCompletedMessage: string;
  completedMessage: string;
};

/**
 * UI/ログに出すステージ別メッセージを一箇所に集約します。
 * 文字列の揺れをなくし、将来のi18n・コピー変更をしやすくします。
 */
export function getDefaultStageMessages(stage: ProcessingStage): StageMessages {
  switch (stage) {
    case 'download':
      return {
        taskQueuedMessage: 'Download tasks queued',
        alreadyCompletedMessage: 'Download already completed',
        completedMessage: 'Download completed',
      };
    case 'extract1':
      return {
        taskQueuedMessage: 'Extract1 tasks queued',
        alreadyCompletedMessage: 'Extract1 already completed',
        completedMessage: 'Extract1 completed',
      };
    case 'extract2':
      return {
        taskQueuedMessage: 'Extract2 tasks queued',
        alreadyCompletedMessage: 'Extract2 already completed',
        completedMessage: 'Extract2 completed',
      };
    case 'vectortile':
      return {
        taskQueuedMessage: 'Vector tile tasks queued',
        alreadyCompletedMessage: 'Vector tiles already completed',
        completedMessage: 'Vector tiles completed',
      };
    default:
      return {
        taskQueuedMessage: `${stage} tasks queued`,
        alreadyCompletedMessage: `${stage} already completed`,
        completedMessage: `${stage} completed`,
      };
  }
}
