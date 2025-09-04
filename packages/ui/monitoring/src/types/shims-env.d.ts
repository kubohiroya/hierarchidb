declare const process: {
  env: Record<string, string | undefined>;
};

declare namespace NodeJS {
  type Timeout = number;
}

