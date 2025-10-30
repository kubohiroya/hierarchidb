export const UIShellPackages = [
  'components',
  'plugin-ui-host',
  'ui-auth',
  'ui-dialog',
  'ui-icon',
  'ui-i18n',
  'ui-layout',
  'ui-map',
  'ui-navigation',
  'ui-routing',
  'ui-theme',
  'ui-tour',
  'ui-treeconsole-base',
  'ui-treeconsole-breadcrumb',
  'ui-treeconsole-toolbar',
  'ui-treeconsole-treetable',
  'ui-usermenu',
] as const;

export type UIShellPackageId = typeof UIShellPackages[number];
