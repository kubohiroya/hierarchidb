// Local subpath type bridge for MUI's import of 'react-transition-group/Transition'
declare module 'react-transition-group/Transition' {
  export { Transition as default } from 'react-transition-group';
  // Provide loose types expected by MUI's transition.d.ts
  export type TransitionProps = any;
  export type TransitionActions = any;
}
