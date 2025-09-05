/**
 * FolderBasicInfoStep Component
 * フォルダの基本情報入力ステップ（Step1）
 */

import React from 'react';
import { Box, Typography, Stack, Divider } from '@mui/material';
import { Folder as FolderIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { EntityId } from '@hierarchidb/common-type';
import { TagInput } from './TagInput';
import { BasicInfoFields } from '@hierarchidb/ui-core';

type TagId = EntityId;

export interface FolderBasicInfoStepProps {
  workingCopy: { name?: string; description?: string; tags?: TagId[] };
  onUpdate: (updates: Partial<FolderBasicInfoStepProps['workingCopy']>) => void;
  disabled?: boolean;
}

/**
 * フォルダの基本情報入力コンポーネント
 * 名前、説明、タグの入力フォームを提供
 */
export const FolderBasicInfoStep: React.FC<FolderBasicInfoStepProps> = ({
  workingCopy,
  onUpdate,
  disabled = false,
}) => {
  const { t } = useTranslation('folderPlugin');

  // タグ変更ハンドラー

  const handleTagChange = (tags: TagId[]) => {
    onUpdate({ tags });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
      {/* セクションヘッダー */}
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <FolderIcon color="primary" />
        <Typography variant="h6">{t('basicInfo.title', 'Basic Information')}</Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" paragraph>
        {t(
          'basicInfo.description',
          'Enter basic folder information. Use tags to categorize and make folders easy to search.'
        )}
      </Typography>

      <Stack spacing={3}>
        <BasicInfoFields
          value={{ name: workingCopy.name, description: workingCopy.description }}
          onChange={onUpdate}
          disabled={disabled}
          nameLabel={t('basicInfo.name.label', 'Folder Name')}
          nameHelperText={t('basicInfo.name.helper', 'Enter a descriptive folder name')}
          nameRequiredText={t('basicInfo.name.required', 'Folder name is required')}
          namePlaceholder={t('basicInfo.name.placeholder', 'Enter folder name')}
          descriptionLabel={t('basicInfo.description.label', 'Description')}
          descriptionHelperText={t(
            'basicInfo.description.helper',
            'Describe the purpose or contents of this folder (optional)'
          )}
          descriptionPlaceholder={t('basicInfo.description.placeholder', 'Enter description (optional)')}
        />

        <Divider />

        {/* タグ入力セクション */}
        <Box>
          <TagInput
            value={workingCopy.tags || []}
            onChange={handleTagChange}
            placeholder={t('basicInfo.tags.placeholder', 'Enter or select tags...')}
            label={t('basicInfo.tags.label', 'Tags')}
            helperText={t('basicInfo.tags.helper', 'Add tags to categorize this folder')}
            maxTags={10}
            allowCreate={true}
            disabled={disabled}
          />
        </Box>
      </Stack>

      {/* フォーム下部の情報表示 */}
      <Box mt={4} p={2} bgcolor="grey.50" borderRadius={1}>
        <Typography variant="caption" color="text.secondary">
          💡 <strong>{t('basicInfo.hint.title', 'Tip:')}</strong>{' '}
          {t(
            'basicInfo.hint.content',
            'Using tags makes it easy to search and organize folders. Examples: "Project", "Important", "Archive", etc.'
          )}
        </Typography>
      </Box>
    </Box>
  );
};
