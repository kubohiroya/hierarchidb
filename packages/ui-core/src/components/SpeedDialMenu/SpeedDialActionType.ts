export interface SpeedDialActionType {
  icon: React.ReactNode;
  name: string;
  onClick: () => void;
  disabled?: boolean;
}
