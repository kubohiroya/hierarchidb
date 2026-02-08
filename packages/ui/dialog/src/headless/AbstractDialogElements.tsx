import type { ReactElement, ReactNode } from 'react';
import type { HeadlessDialogContentProps, HeadlessDialogFooterProps, HeadlessDialogHeaderProps, HeadlessFooterRenderProps, HeadlessHeaderRenderProps } from './types.js';

export type AbstractDialogHeaderProps<TData> = {
  HeaderComponent: React.ComponentType<HeadlessDialogHeaderProps<TData>>;
  headerRenderer?: (props: HeadlessHeaderRenderProps<TData>) => ReactNode;
};

export const AbstractDialogHeader = <TData,>({
  HeaderComponent,
  headerRenderer,
}: AbstractDialogHeaderProps<TData>): ReactElement => (
  <HeaderComponent>{headerRenderer}</HeaderComponent>
);

export type AbstractDialogContentProps<TData> = {
  ContentComponent: React.ComponentType<HeadlessDialogContentProps<TData>>;
};

export const AbstractDialogContent = <TData,>({
  ContentComponent,
}: AbstractDialogContentProps<TData>): ReactElement => <ContentComponent />;

export type AbstractDialogFooterProps<TData> = {
  FooterComponent: React.ComponentType<HeadlessDialogFooterProps<TData>>;
  footerRenderer?: (props: HeadlessFooterRenderProps<TData>) => ReactNode;
};

export const AbstractDialogFooter = <TData,>({
  FooterComponent,
  footerRenderer,
}: AbstractDialogFooterProps<TData>): ReactElement => (
  <FooterComponent>{footerRenderer}</FooterComponent>
);
