declare module '@hierarchidb/ui-dialog' {
  export type DialogStep = {
    id: string;
    label?: string;
    component: any;
    validate?: (data?: any) => boolean | Promise<boolean>;
    optional?: boolean;
  };
  export const MultiStepDialog: any;
}

