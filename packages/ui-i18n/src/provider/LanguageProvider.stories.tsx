import type { Meta, StoryObj } from '@storybook/react';
import { useTranslation } from 'react-i18next';
import { Button, Stack, Typography, Card, CardContent } from '@mui/material';
import { LanguageProvider, useLanguage } from './LanguageProvider';

// Demo component that uses i18n
const I18nDemo: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { currentLanguage, changeLanguage, supportedLanguages } = useLanguage();

  return (
    <Card sx={{ maxWidth: 500, margin: 'auto' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          {t('welcome')} 🌍
        </Typography>

        <Typography variant="body1" paragraph>
          {t('hello', { name: 'HierarchiDB User' })}
        </Typography>

        <Typography variant="body2" color="text.secondary" paragraph>
          Current Language: {currentLanguage.nativeName} {currentLanguage.flag}
        </Typography>

        <Stack direction="row" spacing={2} flexWrap="wrap">
          {supportedLanguages.map((lang) => (
            <Button
              key={lang.code}
              variant={lang.code === currentLanguage.code ? 'contained' : 'outlined'}
              onClick={() => changeLanguage(lang.code)}
              startIcon={<span>{lang.flag}</span>}
            >
              {lang.nativeName}
            </Button>
          ))}
        </Stack>

        <Stack sx={{ mt: 2 }} spacing={1}>
          <Typography variant="body2">
            {t('language')}: {currentLanguage.name}
          </Typography>
          <Typography variant="body2">
            {t('settings')}: {t('settings')}
          </Typography>
          <Typography variant="body2">
            {t('profile')}: {t('profile')}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
};

const meta = {
  title: 'I18n/LanguageProvider',
  component: LanguageProvider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LanguageProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <LanguageProvider>
      <I18nDemo />
    </LanguageProvider>
  ),
};

export const JapaneseDefault: Story = {
  render: () => (
    <LanguageProvider defaultLanguage="ja">
      <I18nDemo />
    </LanguageProvider>
  ),
};

// Simple language switcher component
const LanguageSwitcher: React.FC = () => {
  const { currentLanguage, changeLanguage, supportedLanguages } = useLanguage();

  return (
    <Stack direction="row" spacing={1}>
      {supportedLanguages.map((lang) => (
        <Button
          key={lang.code}
          size="small"
          variant={lang.code === currentLanguage.code ? 'contained' : 'text'}
          onClick={() => changeLanguage(lang.code)}
        >
          {lang.flag} {lang.code.toUpperCase()}
        </Button>
      ))}
    </Stack>
  );
};

export const LanguageSwitcherOnly: Story = {
  render: () => (
    <LanguageProvider>
      <LanguageSwitcher />
    </LanguageProvider>
  ),
};

// Translation example component
const TranslationExample: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Translation Examples:</Typography>
      <Typography>Simple: {t('welcome')}</Typography>
      <Typography>With interpolation: {t('hello', { name: 'John' })}</Typography>
      <Typography>Fallback: {t('nonexistent', 'Fallback text')}</Typography>
    </Stack>
  );
};

export const TranslationExamples: Story = {
  render: () => (
    <LanguageProvider>
      <Stack spacing={3}>
        <LanguageSwitcher />
        <TranslationExample />
      </Stack>
    </LanguageProvider>
  ),
};
